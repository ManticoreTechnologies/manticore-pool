#!/bin/bash

set -e

# Variables
EVRMORE_USER="evrmored"
EVRMORE_GROUP="evrmored"
EVRMORE_DIR="/opt/evrmored"
EVRMORE_BINARY="/path/to/evrmored"  # Replace with the actual binary path
SERVICE_FILE="/etc/systemd/system/evrmored.service"

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
  chown -R $EVRMORE_USER:$EVRMORE_GROUP $EVRMORE_DIR
  chmod 750 $EVRMORE_DIR
  echo "Directories set up at $EVRMORE_DIR."
}

create_service_file() {
  echo "Creating systemd service file..."
  cat << EOF > $SERVICE_FILE
[Unit]
Description=Evrmore Daemon
After=network.target

[Service]
ExecStart=$EVRMORE_BINARY
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

manage_service() {
  echo "Evrmored service management commands:"
  echo "  systemctl status evrmored    # Check the service status"
  echo "  systemctl start evrmored     # Start the service"
  echo "  systemctl stop evrmored      # Stop the service"
  echo "  systemctl restart evrmored   # Restart the service"
  echo "  systemctl enable evrmored    # Enable the service on boot"
  echo "  systemctl disable evrmored   # Disable the service on boot"
}

# Main Script
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

if [[ ! -f $EVRMORE_BINARY ]]; then
  echo "Binary not found at $EVRMORE_BINARY. Please check the path and update the script." >&2
  exit 1
fi

create_user_and_group
setup_directories
create_service_file
enable_and_start_service
manage_service

echo "Installation and setup complete. Evrmore Daemon is now managed as a systemd service."
