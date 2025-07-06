import socket
import serial
import serial.tools.list_ports

def get_first_serial_port():
    ports = serial.tools.list_ports.comports()
    if not ports:
        print("[ERROR] No COM ports found.")
        exit(1)
    selected_port = ports[0].device
    print(f"[INFO] Automatically selected COM port: {selected_port}")
    return selected_port

def main():
    serial_port = get_first_serial_port()
    baud_rate = 9600
    tcp_port = 5000

    try:
        ser = serial.Serial(serial_port, baud_rate, timeout=1)
        print(f"[INFO] Connected to {serial_port} at {baud_rate} baud")
    except Exception as e:
        print(f"[ERROR] Could not open serial port {serial_port}: {e}")
        return

    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.bind(('0.0.0.0', tcp_port))
    server_socket.listen(1)
    print(f"[INFO] Listening on TCP port {tcp_port}...")

    conn, addr = server_socket.accept()
    print(f"[INFO] Client connected: {addr}")

    try:
        while True:
            data = conn.recv(1024)
            if data:
                print(f"[TCP → SERIAL] {data}")
                ser.write(data)

            if ser.in_waiting:
                serial_data = ser.read(ser.in_waiting)
                print(f"[SERIAL → TCP] {serial_data}")
                conn.sendall(serial_data)

    except Exception as e:
        print(f"[ERROR] {e}")
    finally:
        conn.close()
        ser.close()
        server_socket.close()
        print("[INFO] Connection closed.")

if __name__ == "__main__":
    main()
