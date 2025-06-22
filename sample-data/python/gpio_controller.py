#!/usr/bin/env python3
"""
Raspberry Pi GPIO Control and Monitoring System
Controls LEDs, reads sensors, and provides web interface
Supports multiple sensor types and GPIO configurations
"""

import RPi.GPIO as GPIO
import time
import json
import threading
from flask import Flask, render_template_string, jsonify, request
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# GPIO Pin definitions
LED_PINS = [18, 19, 20, 21]  # LED pins
BUTTON_PINS = [2, 3, 4, 14]  # Button pins
SENSOR_PINS = {'temperature': 22, 'motion': 23, 'light': 24}

# Flask app
app = Flask(__name__)

# Global variables
gpio_states = {}
sensor_data = {}
system_running = True

class GPIOController:
    """Main GPIO controller class"""
    
    def __init__(self):
        self.setup_gpio()
        self.setup_sensors()
        
    def setup_gpio(self):
        """Initialize GPIO pins"""
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        
        # Setup LED pins as outputs
        for pin in LED_PINS:
            GPIO.setup(pin, GPIO.OUT)
            GPIO.output(pin, GPIO.LOW)
            gpio_states[f'led_{pin}'] = False
            
        # Setup button pins as inputs with pull-up resistors
        for pin in BUTTON_PINS:
            GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            gpio_states[f'button_{pin}'] = False
            
        logger.info("GPIO pins initialized")
        
    def setup_sensors(self):
        """Initialize sensor pins"""
        for sensor, pin in SENSOR_PINS.items():
            if sensor == 'motion':
                GPIO.setup(pin, GPIO.IN)
            elif sensor == 'light':
                GPIO.setup(pin, GPIO.IN)
            # Temperature sensor would be connected via 1-Wire or I2C
            
        logger.info("Sensor pins initialized")
        
    def toggle_led(self, pin):
        """Toggle LED state"""
        if pin in LED_PINS:
            current_state = GPIO.input(pin)
            new_state = not current_state
            GPIO.output(pin, new_state)
            gpio_states[f'led_{pin}'] = new_state
            logger.info(f"LED {pin} toggled to {new_state}")
            return new_state
        return False
        
    def set_led(self, pin, state):
        """Set LED to specific state"""
        if pin in LED_PINS:
            GPIO.output(pin, state)
            gpio_states[f'led_{pin}'] = state
            logger.info(f"LED {pin} set to {state}")
            return True
        return False
        
    def read_sensors(self):
        """Read all sensor values"""
        try:
            # Read digital sensors
            sensor_data['motion'] = GPIO.input(SENSOR_PINS['motion'])
            sensor_data['light'] = GPIO.input(SENSOR_PINS['light'])
            
            # Simulate temperature reading (would use actual sensor in real implementation)
            import random
            sensor_data['temperature'] = round(20 + random.uniform(-5, 15), 1)
            sensor_data['humidity'] = round(40 + random.uniform(-10, 30), 1)
            
            # Read button states
            for pin in BUTTON_PINS:
                gpio_states[f'button_{pin}'] = not GPIO.input(pin)  # Invert due to pull-up
                
            sensor_data['timestamp'] = datetime.now().isoformat()
            
        except Exception as e:
            logger.error(f"Error reading sensors: {e}")
            
    def blink_pattern(self, pin, pattern, repeat=1):
        """Blink LED in specific pattern"""
        def blink():
            for _ in range(repeat):
                for duration in pattern:
                    if duration > 0:
                        GPIO.output(pin, GPIO.HIGH)
                        time.sleep(duration)
                    else:
                        GPIO.output(pin, GPIO.LOW)
                        time.sleep(abs(duration))
                        
        threading.Thread(target=blink, daemon=True).start()
        
    def cleanup(self):
        """Cleanup GPIO resources"""
        GPIO.cleanup()
        logger.info("GPIO cleanup completed")

# Initialize GPIO controller
gpio_controller = GPIOController()

# Web interface HTML template
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Raspberry Pi GPIO Control</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f0f0f0; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .led-control { display: inline-block; margin: 10px; }
        .led-btn { padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        .led-on { background: #4CAF50; color: white; }
        .led-off { background: #f44336; color: white; }
        .sensor-value { font-size: 1.2em; font-weight: bold; color: #2196F3; }
        .status-indicator { width: 20px; height: 20px; border-radius: 50%; display: inline-block; margin-left: 10px; }
        .status-on { background: #4CAF50; }
        .status-off { background: #f44336; }
        button { background: #2196F3; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; margin: 5px; }
        button:hover { background: #1976D2; }
    </style>
    <script>
        function toggleLED(pin) {
            fetch('/toggle_led/' + pin, {method: 'POST'})
                .then(response => response.json())
                .then(data => {
                    location.reload();
                });
        }
        
        function updateSensors() {
            fetch('/api/sensors')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('temp').innerText = data.temperature + '°C';
                    document.getElementById('humidity').innerText = data.humidity + '%';
                    document.getElementById('motion').className = 'status-indicator ' + (data.motion ? 'status-on' : 'status-off');
                    document.getElementById('light').className = 'status-indicator ' + (data.light ? 'status-on' : 'status-off');
                });
        }
        
        function blinkPattern(pin) {
            fetch('/blink/' + pin, {method: 'POST'});
        }
        
        setInterval(updateSensors, 2000);
    </script>
</head>
<body>
    <div class="container">
        <h1>Raspberry Pi GPIO Control Panel</h1>
        
        <div class="section">
            <h2>LED Controls</h2>
            {% for pin in led_pins %}
            <div class="led-control">
                <button class="led-btn {% if gpio_states['led_' + pin|string] %}led-on{% else %}led-off{% endif %}" 
                        onclick="toggleLED({{ pin }})">
                    LED {{ pin }} {% if gpio_states['led_' + pin|string] %}ON{% else %}OFF{% endif %}
                </button>
                <button onclick="blinkPattern({{ pin }})">Blink</button>
            </div>
            {% endfor %}
        </div>
        
        <div class="section">
            <h2>Sensor Readings</h2>
            <p>Temperature: <span class="sensor-value" id="temp">{{ sensor_data.get('temperature', '--') }}°C</span></p>
            <p>Humidity: <span class="sensor-value" id="humidity">{{ sensor_data.get('humidity', '--') }}%</span></p>
            <p>Motion: <span class="status-indicator {% if sensor_data.get('motion') %}status-on{% else %}status-off{% endif %}" id="motion"></span></p>
            <p>Light: <span class="status-indicator {% if sensor_data.get('light') %}status-on{% else %}status-off{% endif %}" id="light"></span></p>
        </div>
        
        <div class="section">
            <h2>Button States</h2>
            {% for pin in button_pins %}
            <p>Button {{ pin }}: 
                <span class="status-indicator {% if gpio_states['button_' + pin|string] %}status-on{% else %}status-off{% endif %}"></span>
                {% if gpio_states['button_' + pin|string] %}PRESSED{% else %}RELEASED{% endif %}
            </p>
            {% endfor %}
        </div>
        
        <div class="section">
            <h2>System Controls</h2>
            <button onclick="fetch('/api/all_off', {method: 'POST'}).then(() => location.reload())">All LEDs Off</button>
            <button onclick="fetch('/api/all_on', {method: 'POST'}).then(() => location.reload())">All LEDs On</button>
            <button onclick="updateSensors()">Refresh Sensors</button>
        </div>
    </div>
</body>
</html>
'''

@app.route('/')
def index():
    """Main web interface"""
    gpio_controller.read_sensors()
    return render_template_string(HTML_TEMPLATE, 
                                led_pins=LED_PINS,
                                button_pins=BUTTON_PINS,
                                gpio_states=gpio_states,
                                sensor_data=sensor_data)

@app.route('/toggle_led/<int:pin>', methods=['POST'])
def toggle_led(pin):
    """Toggle LED state"""
    success = gpio_controller.toggle_led(pin)
    return jsonify({'success': success, 'pin': pin, 'state': gpio_states.get(f'led_{pin}', False)})

@app.route('/blink/<int:pin>', methods=['POST'])
def blink_led(pin):
    """Blink LED pattern"""
    pattern = [0.2, -0.2, 0.2, -0.2, 0.2, -0.5]  # On-off pattern
    gpio_controller.blink_pattern(pin, pattern, repeat=1)
    return jsonify({'success': True, 'pin': pin})

@app.route('/api/sensors')
def api_sensors():
    """Get current sensor readings"""
    gpio_controller.read_sensors()
    return jsonify(sensor_data)

@app.route('/api/gpio_states')
def api_gpio_states():
    """Get current GPIO states"""
    return jsonify(gpio_states)

@app.route('/api/all_off', methods=['POST'])
def all_leds_off():
    """Turn off all LEDs"""
    for pin in LED_PINS:
        gpio_controller.set_led(pin, False)
    return jsonify({'success': True, 'action': 'all_off'})

@app.route('/api/all_on', methods=['POST'])
def all_leds_on():
    """Turn on all LEDs"""
    for pin in LED_PINS:
        gpio_controller.set_led(pin, True)
    return jsonify({'success': True, 'action': 'all_on'})

@app.route('/api/system_info')
def system_info():
    """Get system information"""
    import psutil
    import platform
    
    info = {
        'cpu_percent': psutil.cpu_percent(),
        'memory_percent': psutil.virtual_memory().percent,
        'temperature': get_cpu_temperature(),
        'platform': platform.platform(),
        'uptime': time.time() - psutil.boot_time()
    }
    return jsonify(info)

def get_cpu_temperature():
    """Get CPU temperature (Raspberry Pi specific)"""
    try:
        with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
            temp = int(f.read()) / 1000.0
            return round(temp, 1)
    except:
        return None

def sensor_monitoring_loop():
    """Background sensor monitoring"""
    while system_running:
        try:
            gpio_controller.read_sensors()
            
            # Check for motion detection
            if sensor_data.get('motion'):
                logger.info("Motion detected!")
                # Blink LED when motion detected
                gpio_controller.blink_pattern(LED_PINS[0], [0.1, -0.1], repeat=3)
                
            time.sleep(1)
        except Exception as e:
            logger.error(f"Error in sensor monitoring: {e}")
            time.sleep(5)

def cleanup_handler():
    """Cleanup resources on exit"""
    global system_running
    system_running = False
    gpio_controller.cleanup()
    logger.info("System shutdown complete")

if __name__ == '__main__':
    try:
        # Start background sensor monitoring
        sensor_thread = threading.Thread(target=sensor_monitoring_loop, daemon=True)
        sensor_thread.start()
        
        logger.info("Starting Raspberry Pi GPIO Control System")
        logger.info(f"Web interface available at http://localhost:5000")
        
        # Start Flask web server
        app.run(host='0.0.0.0', port=5000, debug=False)
        
    except KeyboardInterrupt:
        logger.info("Shutting down system...")
    finally:
        cleanup_handler()
