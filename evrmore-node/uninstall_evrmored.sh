#!/bin/bash

set -e

# Variables
EVRMORE_USER="evrmored"
EVRMORE_GROUP="evrmored"
EVRMORE_DIR="/opt/evrmored"
SERVICE_FILE="/etc/systemd/system/evrmored.service"

# Functions
stop_and_disable_service() {
  echo "Stopping and disabling evrmored service..."
  systemctl stop evrmored || echo "Service is not running."
  systemctl disable evrmored || echo "Service is not enabled."
  systemctl daemon-reload
  echo "Service stopped and disabled."
}

remove_service_file() {
  echo "Removing service file..."
  if [[ -f $SERVICE_FILE ]]; then
    rm -f $SERVICE_FILE
    echo "Service file removed from $SERVICE_FILE."
  else
    echo "Service file $SERVICE_FILE does not exist."
  fi
}

remove_user_and_group() {
  echo "Removing user and group for evrmored..."
  if id -u $EVRMORE_USER >/dev/null 2>&1; then
    userdel -r $EVRMORE_USER || echo "Failed to remove user $EVRMORE_USER."
    echo "User $EVRMORE_USER removed."
  else
    echo "User $EVRMORE_USER does not exist."
  fi
}

remove_directories() {
  echo "Removing evrmored directories..."
  if [[ -d $EVRMORE_DIR ]]; then
    rm -rf $EVRMORE_DIR
    echo "Directory $EVRMORE_DIR removed."
  else
    echo "Directory $EVRMORE_DIR does not exist."
  fi
}

# Main Script
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

stop_and_disable_service
remove_service_file
remove_user_and_group
remove_directories

echo "Uninstallation complete. Evrmore Daemon has been removed."
