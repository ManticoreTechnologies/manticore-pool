const express = require('express');
const router = express.Router();
const { Workers } = require('./database/workers.js');
router.get('/worker/:workerName', async (req, res) => {
  const workerName = req.params.workerName;
  try {
    const worker = await Workers.getWorker(workerName);
    res.json(worker);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve worker' });
  }
});



app = express();

app.use('/', router);

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});


