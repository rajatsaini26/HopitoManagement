import serial
import time
import json
import re
import asyncio
import websockets

# Initialize serial port
serial_port = 'COM9'  # Change this to your serial port
baud_rate = 9600

async def send_rfid_data(rfid):
    """Send the RFID UID over WebSocket."""
    try:
        # Connect to the Django WebSocket server
        async with websockets.connect("ws://127.0.0.1:8001/ws/rfid/") as websocket:
            # Send the RFID data as JSON
            message = json.dumps({"rfid": rfid})
            await websocket.send(message)
            print(f"Sent UID: {rfid}")
    except websockets.exceptions.WebSocketException as e:
        print(f"Error sending RFID data via WebSocket: {e}")
        await asyncio.sleep(1)  # Wait a moment before retrying
        await send_rfid_data(rfid)  # Retry sending the data
    except Exception as e:
        print(f"Unexpected error: {e}")

def is_valid_uid(uid):
    """Check if the UID matches the expected format (e.g., A3:94:28:1A)."""
    return re.match(r'^[0-9A-F]{2}(:[0-9A-F]{2}){3}$', uid) is not None

async def main():
    try:
        # Open the serial port
        with serial.Serial(serial_port, baud_rate, timeout=1) as ser:
            print("Serial port initialized. Waiting for RFID data...")

            # Loop to read RFID data from the serial port
            while True:
                if ser.in_waiting > 0:
                    raw_data = ser.readline().decode('utf-8').strip()
                    print(f"Raw data read: {raw_data}")

                    try:
                        # Try to parse the incoming data as JSON
                        json_data = json.loads(raw_data)
                        uid = json_data.get("UID", None)

                        # If UID is found and is valid, send it via WebSocket
                        if uid and is_valid_uid(uid):
                            await send_rfid_data(uid)
                        else:
                            print("Invalid UID or no UID in data.")
                    except json.JSONDecodeError:
                        print("Error: Failed to parse JSON data. Skipping...")
                        continue
                else:
                    # No data available, wait for some time
                    print("No data available.")

                await asyncio.sleep(1)
    except serial.SerialException as e:
        print(f"Serial error: {e}")
    except KeyboardInterrupt:
        print("Program terminated by user.")

if __name__ == "__main__":
    # Run the main loop
    asyncio.run(main())
