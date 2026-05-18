/* Warfield - Canvas-based territory warfare renderer
   Renders a living battlefield with Voronoi territory cells, animated frontlines,
   pressure waves, unit markers, and particle effects. */

(function() {
  'use strict';

  var CELL_SIZE = 8;
  var GRID_LINE_ALPHA = 0.06;
  var TERRITORY_ALPHA_BASE = 0.32;
  var TERRITORY_ALPHA_STRONG = 0.55;
  var FRONTLINE_GLOW = 12;
  var PRESSURE_WAVE_SPEED = 0.04;
  var PARTICLE_COUNT = 80;
  var PULSE_SPEED = 0.0012;
  var DECAY_FLICKER_SPEED = 0.006;

  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return { r: r, g: g, b: b };
  }

  function lerpColor(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t)
    };
  }

  function distance(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function seededRandom(seed) {
    var value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return function() {
      value = value * 16807 % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function Warfield(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.cols = 0;
    this.rows = 0;
    this.grid = null;
    this.state = null;
    this.time = 0;
    this.lastDataTime = 0;
    this.particles = [];
    this.pressureWaves = [];
    this.eventFlash = 0;
    this.eventFlashColor = null;
    this.sectorColors = {};
    this.running = false;
    this.frameId = null;
    this.territoryBuffer = null;
    this.territoryCtx = null;
    this.noiseGrid = null;
    this.selectedSector = null;
    this.onSectorSelect = null;

    this._boundRender = this._render.bind(this);
    this._boundResize = this._resize.bind(this);
    window.addEventListener('resize', this._boundResize);
    canvas.addEventListener('click', this._onClick.bind(this));
    canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
    this.hoveredSector = null;
  }

  Warfield.prototype.start = function() {
    if (this.running) return;
    this.running = true;
    this._resize();
    this._initParticles();
    this._render(performance.now());
  };

  Warfield.prototype.stop = function() {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  };

  Warfield.prototype.destroy = function() {
    this.stop();
    window.removeEventListener('resize', this._boundResize);
  };

  Warfield.prototype.updateState = function(state) {
    this.state = state;
    this.lastDataTime = performance.now();
    this._buildGrid();
    this._cacheColors();
    this._spawnPressureWaves();
    if (state.networkEvents && state.networkEvents.length > 0) {
      var evt = state.networkEvents[0];
      if (evt.type === 'block_found' && evt.faction) {
        var fc = (state.factions || []).find(function(f) { return f.id === evt.faction; });
        this.eventFlash = 1.0;
        this.eventFlashColor = fc ? hexToRgb(fc.color) : { r: 255, g: 157, b: 46 };
      } else if (evt.type === 'difficulty_spike') {
        this.eventFlash = 0.8;
        this.eventFlashColor = { r: 255, g: 60, b: 60 };
      } else if (evt.type === 'hashrate_drop') {
        this.eventFlash = 0.6;
        this.eventFlashColor = { r: 100, g: 100, b: 180 };
      }
    }
  };

  Warfield.prototype._resize = function() {
    var rect = this.canvas.parentElement.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = Math.floor(rect.width);
    var h = Math.floor(rect.height);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
    this.cols = Math.ceil(w / CELL_SIZE);
    this.rows = Math.ceil(h / CELL_SIZE);

    this.territoryBuffer = document.createElement('canvas');
    this.territoryBuffer.width = this.cols;
    this.territoryBuffer.height = this.rows;
    this.territoryCtx = this.territoryBuffer.getContext('2d');

    this._generateNoise();
    this._buildGrid();
  };

  Warfield.prototype._generateNoise = function() {
    var rng = seededRandom(42);
    this.noiseGrid = new Float32Array(this.cols * this.rows);
    for (var i = 0; i < this.noiseGrid.length; i++) {
      this.noiseGrid[i] = rng() * 0.3 - 0.15;
    }
  };

  Warfield.prototype._cacheColors = function() {
    if (!this.state) return;
    this.sectorColors = {};
    var territories = this.state.territories || [];
    for (var i = 0; i < territories.length; i++) {
      var t = territories[i];
      this.sectorColors[t.id] = hexToRgb(t.ownerColor);
    }
  };

  Warfield.prototype._buildGrid = function() {
    if (!this.state || !this.cols || !this.rows) return;
    var territories = this.state.territories || [];
    if (!territories.length) return;

    this.grid = new Int8Array(this.cols * this.rows);
    var w = this.width;
    var h = this.height;

    for (var row = 0; row < this.rows; row++) {
      for (var col = 0; col < this.cols; col++) {
        var px = (col + 0.5) * CELL_SIZE;
        var py = (row + 0.5) * CELL_SIZE;
        var bestDist = Infinity;
        var bestIdx = 0;
        for (var ti = 0; ti < territories.length; ti++) {
          var tx = territories[ti].x * w / 100;
          var ty = territories[ti].y * h / 100;
          var d = (px - tx) * (px - tx) + (py - ty) * (py - ty);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = ti;
          }
        }
        this.grid[row * this.cols + col] = bestIdx;
      }
    }
  };

  Warfield.prototype._initParticles = function() {
    this.particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push({
        x: Math.random() * (this.width || 800),
        y: Math.random() * (this.height || 600),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.3,
        size: 1 + Math.random() * 2,
        alpha: 0.1 + Math.random() * 0.3,
        color: null,
        life: Math.random()
      });
    }
  };

  Warfield.prototype._spawnPressureWaves = function() {
    if (!this.state) return;
    var mapUnits = this.state.mapUnits || [];
    var w = this.width;
    var h = this.height;
    for (var i = 0; i < mapUnits.length; i++) {
      var unit = mapUnits[i];
      if (!unit.active) continue;
      var fc = (this.state.factions || []).find(function(f) { return f.id === unit.faction; });
      if (Math.random() > 0.4) {
        this.pressureWaves.push({
          x: unit.x * w / 100,
          y: unit.y * h / 100,
          radius: 0,
          maxRadius: 30 + unit.attack * 0.15,
          speed: 0.6 + Math.random() * 0.4,
          color: fc ? hexToRgb(fc.color) : { r: 255, g: 157, b: 46 },
          alpha: 0.35
        });
      }
    }
  };

  Warfield.prototype._onClick = function(e) {
    if (!this.state) return;
    var rect = this.canvas.getBoundingClientRect();
    var px = (e.clientX - rect.left) / this.width * 100;
    var py = (e.clientY - rect.top) / this.height * 100;
    var territories = this.state.territories || [];
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < territories.length; i++) {
      var d = distance(px, py, territories[i].x, territories[i].y);
      if (d < bestDist) {
        bestDist = d;
        best = territories[i];
      }
    }
    if (best && bestDist < 15) {
      this.selectedSector = best.id;
      if (this.onSectorSelect) this.onSectorSelect(best);
    }
  };

  Warfield.prototype._onMouseMove = function(e) {
    if (!this.state) return;
    var rect = this.canvas.getBoundingClientRect();
    var px = (e.clientX - rect.left) / this.width * 100;
    var py = (e.clientY - rect.top) / this.height * 100;
    var territories = this.state.territories || [];
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < territories.length; i++) {
      var d = distance(px, py, territories[i].x, territories[i].y);
      if (d < bestDist) {
        bestDist = d;
        best = territories[i];
      }
    }
    this.hoveredSector = (best && bestDist < 15) ? best.id : null;
    this.canvas.style.cursor = this.hoveredSector ? 'pointer' : 'default';
  };

  Warfield.prototype._render = function(timestamp) {
    if (!this.running) return;
    this.time = timestamp;
    var ctx = this.ctx;
    var w = this.width;
    var h = this.height;

    ctx.clearRect(0, 0, w, h);

    this._drawBackground(ctx, w, h);
    this._drawTerritories(ctx, w, h, timestamp);
    this._drawFrontlines(ctx, w, h, timestamp);
    this._drawPressureWaves(ctx, w, h, timestamp);
    this._drawForests(ctx, w, h, timestamp);
    this._drawLinks(ctx, w, h);
    this._drawFacilities(ctx, w, h, timestamp);
    this._drawUnits(ctx, w, h, timestamp);
    this._drawSectorLabels(ctx, w, h, timestamp);
    this._drawParticles(ctx, w, h, timestamp);
    this._drawEventFlash(ctx, w, h, timestamp);

    this.frameId = requestAnimationFrame(this._boundRender);
  };

  Warfield.prototype._drawBackground = function(ctx, w, h) {
    ctx.fillStyle = 'rgb(2, 4, 10)';
    ctx.fillRect(0, 0, w, h);

    var grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.7);
    grad.addColorStop(0, 'rgba(255, 157, 46, 0.04)');
    grad.addColorStop(1, 'rgba(2, 4, 10, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 157, 46, ' + GRID_LINE_ALPHA + ')';
    ctx.lineWidth = 0.5;
    var gridSize = 40;
    ctx.beginPath();
    for (var x = 0; x < w; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (var y = 0; y < h; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  };

  Warfield.prototype._drawTerritories = function(ctx, w, h, timestamp) {
    if (!this.grid || !this.state) return;
    var territories = this.state.territories || [];
    if (!territories.length) return;

    var pulse = Math.sin(timestamp * PULSE_SPEED) * 0.08;
    var tCtx = this.territoryCtx;
    var imgData = tCtx.createImageData(this.cols, this.rows);
    var data = imgData.data;

    for (var row = 0; row < this.rows; row++) {
      for (var col = 0; col < this.cols; col++) {
        var idx = row * this.cols + col;
        var tIdx = this.grid[idx];
        var t = territories[tIdx];
        if (!t) continue;

        var color = this.sectorColors[t.id];
        if (!color) continue;

        var control = t.control / 100;
        var noise = this.noiseGrid ? this.noiseGrid[idx] : 0;
        var alpha = TERRITORY_ALPHA_BASE + (control * (TERRITORY_ALPHA_STRONG - TERRITORY_ALPHA_BASE)) + pulse + noise;

        if (t.status === 'contested') {
          alpha += Math.sin(timestamp * DECAY_FLICKER_SPEED + col * 0.3 + row * 0.2) * 0.12;
        } else if (t.status === 'unstable') {
          alpha += Math.sin(timestamp * DECAY_FLICKER_SPEED * 1.5 + col * 0.5) * 0.08;
        }

        alpha = Math.max(0.08, Math.min(alpha, 0.7));

        var px = (col + 0.5) * CELL_SIZE;
        var py = (row + 0.5) * CELL_SIZE;
        var cx = t.x * w / 100;
        var cy = t.y * h / 100;
        var dist = distance(px, py, cx, cy);
        var maxDist = Math.max(w, h) * 0.25;
        var distFade = 1.0 - Math.min(dist / maxDist, 1.0) * 0.3;
        alpha *= distFade;

        var pi = idx * 4;
        data[pi] = color.r;
        data[pi + 1] = color.g;
        data[pi + 2] = color.b;
        data[pi + 3] = Math.round(alpha * 255);
      }
    }

    tCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.territoryBuffer, 0, 0, this.cols, this.rows, 0, 0, w, h);
  };

  Warfield.prototype._drawFrontlines = function(ctx, w, h, timestamp) {
    if (!this.state) return;
    var frontlines = this.state.frontlines || [];
    if (!frontlines.length) return;

    var glowPulse = 0.5 + Math.sin(timestamp * 0.002) * 0.3;

    for (var i = 0; i < frontlines.length; i++) {
      var fl = frontlines[i];
      var x1 = fl.x1 * w / 100;
      var y1 = fl.y1 * h / 100;
      var x2 = fl.x2 * w / 100;
      var y2 = fl.y2 * h / 100;
      var mx = (x1 + x2) / 2;
      var my = (y1 + y2) / 2;

      var perpX = -(y2 - y1);
      var perpY = x2 - x1;
      var len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
      perpX /= len;
      perpY /= len;
      var wave = Math.sin(timestamp * 0.003 + i * 1.7) * 4;
      mx += perpX * wave;
      my += perpY * wave;

      ctx.save();
      ctx.shadowColor = 'rgba(255, 220, 180, ' + (0.6 * glowPulse) + ')';
      ctx.shadowBlur = FRONTLINE_GLOW;
      ctx.strokeStyle = 'rgba(255, 220, 180, ' + (0.5 * glowPulse) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();
      ctx.restore();

      var dashLen = distance(x1, y1, x2, y2);
      var segCount = Math.max(Math.floor(dashLen / 8), 3);
      for (var s = 0; s < segCount; s++) {
        var t = s / segCount;
        var st = t + (timestamp * 0.0008) % 1;
        st = st % 1;
        var sx = x1 + (x2 - x1) * st + perpX * wave * (1 - Math.abs(st - 0.5) * 2);
        var sy = y1 + (y2 - y1) * st + perpY * wave * (1 - Math.abs(st - 0.5) * 2);
        var sparkAlpha = (0.4 + Math.sin(timestamp * 0.01 + s) * 0.3) * glowPulse;
        ctx.fillStyle = 'rgba(255, 240, 200, ' + sparkAlpha + ')';
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  Warfield.prototype._drawPressureWaves = function(ctx, w, h) {
    var waves = this.pressureWaves;
    for (var i = waves.length - 1; i >= 0; i--) {
      var wave = waves[i];
      wave.radius += wave.speed;
      var progress = wave.radius / wave.maxRadius;
      if (progress >= 1) {
        waves.splice(i, 1);
        continue;
      }
      var alpha = wave.alpha * (1 - progress);
      ctx.strokeStyle = 'rgba(' + wave.color.r + ',' + wave.color.g + ',' + wave.color.b + ',' + alpha + ')';
      ctx.lineWidth = 2 - progress;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  Warfield.prototype._drawForests = function(ctx, w, h, timestamp) {
    if (!this.state || !this.state.map) return;
    var forests = this.state.map.forests || [];
    var pulse = Math.sin(timestamp * 0.0008) * 0.04;

    for (var i = 0; i < forests.length; i++) {
      var f = forests[i];
      var fx = f.x * w / 100;
      var fy = f.y * h / 100;
      var fSize = f.size * 1.6;
      var alpha = 0.08 + f.density * 0.015 + pulse;
      ctx.strokeStyle = 'rgba(120, 245, 165, ' + alpha + ')';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(fx, fy, fSize, fSize * 0.65, f.density * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(fx, fy, fSize * 0.7, fSize * 0.45, f.density * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  Warfield.prototype._drawLinks = function(ctx, w, h) {
    if (!this.state || !this.state.map) return;
    var links = this.state.map.links || [];
    var frontlineSet = {};
    var frontlines = this.state.frontlines || [];
    for (var fi = 0; fi < frontlines.length; fi++) {
      frontlineSet[frontlines[fi].from + ':' + frontlines[fi].to] = true;
      frontlineSet[frontlines[fi].to + ':' + frontlines[fi].from] = true;
    }

    ctx.strokeStyle = 'rgba(255, 177, 64, 0.12)';
    ctx.lineWidth = 0.6;
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (frontlineSet[link.from + ':' + link.to]) continue;
      if (link.x1 == null || link.y1 == null) continue;
      ctx.beginPath();
      ctx.moveTo(link.x1 * w / 100, link.y1 * h / 100);
      ctx.lineTo(link.x2 * w / 100, link.y2 * h / 100);
      ctx.stroke();
    }
  };

  Warfield.prototype._drawFacilities = function(ctx, w, h, timestamp) {
    if (!this.state || !this.state.map) return;
    var facilities = this.state.map.facilities || [];
    var pulse = Math.sin(timestamp * 0.002) * 0.15;

    for (var i = 0; i < facilities.length; i++) {
      var f = facilities[i];
      var fx = f.x * w / 100;
      var fy = f.y * h / 100;
      var color = hexToRgb(f.ownerColor || '#ff9d2e');
      var alpha = 0.5 + pulse;

      ctx.save();
      ctx.shadowColor = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',0.5)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + alpha + ')';
      ctx.lineWidth = 1;

      if (f.type === 'power-plant' || f.type === 'shield-array') {
        ctx.beginPath();
        ctx.arc(fx, fy, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.type === 'relay') {
        ctx.beginPath();
        ctx.moveTo(fx, fy - 7);
        ctx.lineTo(fx + 6, fy + 5);
        ctx.lineTo(fx - 6, fy + 5);
        ctx.closePath();
        ctx.stroke();
      } else if (f.type === 'foundry') {
        ctx.beginPath();
        ctx.rect(fx - 5, fy - 5, 10, 10);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.rect(fx - 6, fy - 4, 12, 8);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  Warfield.prototype._drawUnits = function(ctx, w, h, timestamp) {
    if (!this.state) return;
    var mapUnits = this.state.mapUnits || [];

    for (var i = 0; i < mapUnits.length; i++) {
      var unit = mapUnits[i];
      var ux = unit.x * w / 100;
      var uy = unit.y * h / 100;
      var fc = (this.state.factions || []).find(function(f) { return f.id === unit.faction; });
      var color = fc ? hexToRgb(fc.color) : { r: 255, g: 157, b: 46 };

      var sizeBase = 6;
      if (unit.className === 'Titan') sizeBase = 14;
      else if (unit.className === 'Dreadnought') sizeBase = 12;
      else if (unit.className === 'Siege Engine') sizeBase = 11;
      else if (unit.className === 'Gladiator') sizeBase = 9;
      else if (unit.className === 'Striker') sizeBase = 8;
      else if (unit.className === 'Swarmer') sizeBase = 7;

      var activePulse = unit.active ? (Math.sin(timestamp * 0.004 + i) * 0.3 + 0.7) : 0.4;

      ctx.save();
      if (unit.active) {
        ctx.shadowColor = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ', 0.8)';
        ctx.shadowBlur = 12 + Math.sin(timestamp * 0.003 + i) * 4;
      }

      var stanceColor = unit.stance === 'assault' ? { r: 255, g: 91, b: 99 }
        : unit.stance === 'defend' ? { r: 140, g: 165, b: 255 }
        : { r: 120, g: 245, b: 165 };

      ctx.fillStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (0.2 * activePulse) + ')';
      ctx.beginPath();
      ctx.arc(ux, uy, sizeBase + 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.strokeStyle = 'rgba(' + stanceColor.r + ',' + stanceColor.g + ',' + stanceColor.b + ',' + activePulse + ')';
      ctx.lineWidth = 1.5;

      if (unit.archetype === 'Tank' || unit.archetype === 'Sentinel') {
        ctx.beginPath();
        ctx.rect(ux - sizeBase * 0.7, uy - sizeBase * 0.7, sizeBase * 1.4, sizeBase * 1.4);
        ctx.fill();
        ctx.stroke();
      } else if (unit.archetype === 'Glass Cannon' || unit.archetype === 'Assault') {
        ctx.beginPath();
        ctx.moveTo(ux, uy - sizeBase);
        ctx.lineTo(ux + sizeBase * 0.85, uy + sizeBase * 0.6);
        ctx.lineTo(ux - sizeBase * 0.85, uy + sizeBase * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(ux, uy, sizeBase * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.8 * activePulse) + ')';
      ctx.font = Math.max(7, sizeBase * 0.8) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unit.callsign.slice(0, 2).toUpperCase(), ux, uy + 0.5);

      ctx.restore();
    }
  };

  Warfield.prototype._drawSectorLabels = function(ctx, w, h, timestamp) {
    if (!this.state) return;
    var territories = this.state.territories || [];

    for (var i = 0; i < territories.length; i++) {
      var t = territories[i];
      var tx = t.x * w / 100;
      var ty = t.y * h / 100;
      var color = this.sectorColors[t.id] || { r: 255, g: 157, b: 46 };
      var isSelected = t.id === this.selectedSector;
      var isHovered = t.id === this.hoveredSector;
      var highlight = isSelected || isHovered;

      ctx.save();
      if (highlight) {
        ctx.shadowColor = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ', 0.8)';
        ctx.shadowBlur = 16;
      }

      var circleAlpha = highlight ? 0.6 : 0.25;
      var r = t.size * 0.9 + 8;
      ctx.strokeStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + circleAlpha + ')';
      ctx.lineWidth = highlight ? 2 : 1;
      ctx.beginPath();
      ctx.arc(tx, ty, r, 0, Math.PI * 2);
      ctx.stroke();

      if (t.status === 'contested') {
        var contestAlpha = 0.15 + Math.sin(timestamp * 0.004 + i) * 0.1;
        ctx.strokeStyle = 'rgba(255, 220, 100, ' + contestAlpha + ')';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(tx, ty, r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = 'rgba(255, 255, 255, ' + (highlight ? 0.9 : 0.6) + ')';
      ctx.font = (highlight ? 'bold ' : '') + '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(t.name, tx, ty - r - 4);

      ctx.fillStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (highlight ? 1 : 0.7) + ')';
      ctx.font = 'bold 13px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.control + '%', tx, ty);

      if (t.status === 'contested') {
        ctx.fillStyle = 'rgba(255, 200, 100, 0.5)';
        ctx.font = '8px monospace';
        ctx.textBaseline = 'top';
        ctx.fillText('CONTESTED', tx, ty + r + 3);
      } else if (t.status === 'unstable') {
        ctx.fillStyle = 'rgba(255, 100, 100, 0.4)';
        ctx.font = '8px monospace';
        ctx.textBaseline = 'top';
        ctx.fillText('UNSTABLE', tx, ty + r + 3);
      }

      ctx.restore();
    }
  };

  Warfield.prototype._drawParticles = function(ctx, w, h, timestamp) {
    if (!this.state) return;
    var territories = this.state.territories || [];

    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life += 0.002;

      if (p.x < 0 || p.x > w || p.y < 0 || p.y > h || p.life > 1) {
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.life = 0;
        p.alpha = 0.1 + Math.random() * 0.3;
        p.color = null;
      }

      if (!p.color && territories.length) {
        var px = p.x / w * 100;
        var py = p.y / h * 100;
        var best = territories[0];
        var bestD = Infinity;
        for (var ti = 0; ti < territories.length; ti++) {
          var d = distance(px, py, territories[ti].x, territories[ti].y);
          if (d < bestD) { bestD = d; best = territories[ti]; }
        }
        p.color = this.sectorColors[best.id] || { r: 255, g: 157, b: 46 };
      }

      var c = p.color || { r: 255, g: 157, b: 46 };
      var fade = 1 - p.life;
      ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (p.alpha * fade) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * fade, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  Warfield.prototype._drawEventFlash = function(ctx, w, h) {
    if (this.eventFlash <= 0) return;
    var c = this.eventFlashColor || { r: 255, g: 157, b: 46 };
    ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (this.eventFlash * 0.15) + ')';
    ctx.fillRect(0, 0, w, h);
    this.eventFlash *= 0.97;
    if (this.eventFlash < 0.01) this.eventFlash = 0;
  };

  Warfield.prototype.injectShare = function(shareEvent) {
    if (!this.state || !shareEvent.territory) return;
    var territories = this.state.territories || [];
    var t = territories.find(function(tt) { return tt.name === shareEvent.territory; });
    if (!t) return;
    var w = this.width || 800;
    var h = this.height || 600;
    var tx = t.x * w / 100;
    var ty = t.y * h / 100;
    var fc = (this.state.factions || []).find(function(f) { return f.id === shareEvent.faction; });
    var color = fc ? hexToRgb(fc.color) : { r: 255, g: 157, b: 46 };
    this.pressureWaves.push({
      x: tx + (Math.random() - 0.5) * 20,
      y: ty + (Math.random() - 0.5) * 20,
      radius: 0,
      maxRadius: shareEvent.valid ? 40 : 15,
      speed: shareEvent.valid ? 0.8 : 0.4,
      color: shareEvent.valid ? color : { r: 255, g: 91, b: 99 },
      alpha: shareEvent.valid ? 0.45 : 0.2
    });
    if (shareEvent.valid) {
      if (!this.territoryPulses) this.territoryPulses = {};
      this.territoryPulses[t.id] = { intensity: 0.4, color: color };
    }
  };

  Warfield.prototype.injectBlock = function(blockEvent) {
    this.eventFlash = 1.5;
    var fc = this.state && (this.state.factions || []).find(function(f) { return f.id === blockEvent.faction; });
    this.eventFlashColor = fc ? hexToRgb(fc.color) : { r: 255, g: 200, b: 50 };
    this.shockwave = { x: this.width / 2, y: this.height / 2, radius: 0, maxRadius: Math.max(this.width, this.height), speed: 4 };
    for (var i = 0; i < 30; i++) {
      this.pressureWaves.push({
        x: this.width * Math.random(),
        y: this.height * Math.random(),
        radius: 0,
        maxRadius: 60 + Math.random() * 40,
        speed: 1 + Math.random(),
        color: this.eventFlashColor,
        alpha: 0.3
      });
    }
  };

  Warfield.prototype.injectBattleEvent = function(evt) {
    if (evt.type === 'territory_flip' || evt.type === 'offline_decay') {
      this.eventFlash = 0.5;
      this.eventFlashColor = { r: 255, g: 100, b: 100 };
    }
  };

  Warfield.prototype._render = function(timestamp) {
    if (!this.running) return;
    this.time = timestamp;
    var ctx = this.ctx;
    var w = this.width;
    var h = this.height;

    ctx.clearRect(0, 0, w, h);
    this._drawBackground(ctx, w, h);
    this._drawTerritories(ctx, w, h, timestamp);
    this._drawTerritoryPulses(ctx, w, h);
    this._drawFrontlines(ctx, w, h, timestamp);
    this._drawPressureWaves(ctx, w, h, timestamp);
    this._drawShockwave(ctx, w, h);
    this._drawForests(ctx, w, h, timestamp);
    this._drawLinks(ctx, w, h);
    this._drawFacilities(ctx, w, h, timestamp);
    this._drawUnits(ctx, w, h, timestamp);
    this._drawSectorLabels(ctx, w, h, timestamp);
    this._drawParticles(ctx, w, h, timestamp);
    this._drawEventFlash(ctx, w, h);

    this.frameId = requestAnimationFrame(this._boundRender);
  };

  Warfield.prototype._drawTerritoryPulses = function(ctx, w, h) {
    if (!this.territoryPulses || !this.state) return;
    var territories = this.state.territories || [];
    var keys = Object.keys(this.territoryPulses);
    for (var i = keys.length - 1; i >= 0; i--) {
      var id = keys[i];
      var pulse = this.territoryPulses[id];
      pulse.intensity *= 0.93;
      if (pulse.intensity < 0.02) { delete this.territoryPulses[id]; continue; }
      var t = territories.find(function(tt) { return tt.id === id; });
      if (!t) continue;
      var cx = t.x * w / 100;
      var cy = t.y * h / 100;
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
      grad.addColorStop(0, 'rgba(' + pulse.color.r + ',' + pulse.color.g + ',' + pulse.color.b + ',' + (pulse.intensity * 0.5) + ')');
      grad.addColorStop(1, 'rgba(' + pulse.color.r + ',' + pulse.color.g + ',' + pulse.color.b + ',0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  Warfield.prototype._drawShockwave = function(ctx, w, h) {
    if (!this.shockwave) return;
    var sw = this.shockwave;
    sw.radius += sw.speed;
    if (sw.radius > sw.maxRadius) { this.shockwave = null; return; }
    var progress = sw.radius / sw.maxRadius;
    var alpha = 0.4 * (1 - progress);
    ctx.strokeStyle = 'rgba(255, 220, 150, ' + alpha + ')';
    ctx.lineWidth = 3 - progress * 2;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
  };

  window.Warfield = Warfield;
})();
