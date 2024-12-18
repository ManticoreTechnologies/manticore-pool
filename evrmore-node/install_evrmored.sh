#!/bin/bash

set -e

# Variables
EVRMORE_USER="evrmored"
EVRMORE_GROUP="evrmored"
EVRMORE_DIR="/opt/evrmored"
EVRMORE_SOURCE_BINARY="/root/manticore-pool/evrmore-node/evrmored"  # Source binary path
EVRMORE_BINARY="$EVRMORE_DIR/evrmored"  # Destination binary path
SERVICE_FILE="/etc/systemd/system/evrmored.service"
CONFIG_DIR="/etc/evrmored"
CONFIG_FILE="$CONFIG_DIR/evrmore.conf"

# Functions
create_user_and_group() {
  echo "Creating user and group for evrmored..."
  if ! id -u $EVRMORE_USER >/dev/null 2>&1; then
    useradd --system --home $EVRMORE_DIR --shell /bin/false $EVRMORE_USER
    echo "User $EVRMORE_USER created."
  else
    echo "User $EVRMORE_USER already exists."
  fi
}

setup_directories() {
  echo "Setting up directories..."
  mkdir -p $EVRMORE_DIR
  mkdir -p $CONFIG_DIR
  chown -R $EVRMORE_USER:$EVRMORE_GROUP $EVRMORE_DIR $CONFIG_DIR
  chmod 750 $EVRMORE_DIR
  echo "Directories set up at $EVRMORE_DIR and $CONFIG_DIR."
}

copy_binary() {
  echo "Copying evrmored binary to $EVRMORE_DIR..."
  if [[ -f $EVRMORE_SOURCE_BINARY ]]; then
    cp $EVRMORE_SOURCE_BINARY $EVRMORE_BINARY
    chown $EVRMORE_USER:$EVRMORE_GROUP $EVRMORE_BINARY
    chmod +x $EVRMORE_BINARY
    echo "Binary copied to $EVRMORE_BINARY."
  else
    echo "Source binary not found at $EVRMORE_SOURCE_BINARY. Please check the path." >&2
    exit 1
  fi
}

create_config_file() {
  echo "Creating configuration file..."
  if [[ ! -f $CONFIG_FILE ]]; then
    cat << EOF > $CONFIG_FILE
# Evrmore Configuration File
daemon=1
server=1
rpcuser=evrmorerpc
rpcpassword=$(openssl rand -hex 16)
EOF
    chown $EVRMORE_USER:$EVRMORE_GROUP $CONFIG_FILE
    chmod 600 $CONFIG_FILE
    echo "Configuration file created at $CONFIG_FILE."
  else
    echo "Configuration file already exists at $CONFIG_FILE."
  fi
}

create_service_file() {
  echo "Creating systemd service file..."
  cat << EOF > $SERVICE_FILE
[Unit]
Description=Evrmore Daemon
After=network.target

[Service]
ExecStart=$EVRMORE_BINARY -conf=$CONFIG_FILE
User=$EVRMORE_USER
Group=$EVRMORE_GROUP
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=evrmored

[Install]
WantedBy=multi-user.target
EOF
  echo "Service file created at $SERVICE_FILE."
}

enable_and_start_service() {
  echo "Enabling and starting evrmored service..."
  systemctl daemon-reload
  systemctl enable evrmored
  systemctl start evrmored
  echo "Service enabled and started."
}

# Main Script
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

if [[ ! -f $EVRMORE_SOURCE_BINARY ]]; then
  echo "Source binary not found at $EVRMORE_SOURCE_BINARY. Please check the path and update the script." >&2
  exit 1
fi

create_user_and_group
setup_directories
copy_binary
create_config_file
create_service_file
enable_and_start_service

echo "Installation complete. Evrmore Daemon is now managed as a systemd service."
