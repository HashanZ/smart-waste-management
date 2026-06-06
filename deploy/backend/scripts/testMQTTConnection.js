"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mqtt_1 = __importDefault(require("mqtt"));
const brokerUrl = process.env['MQTT_BROKER_URL'] || 'mqtt://puffin.rmq2.cloudamqp.com:1883';
const clientId = 'test-client-' + Date.now();
const testConfigs = [
    {
        name: 'No credentials',
    },
    {
        name: 'Username only (ftmvaxpe)',
        username: 'ftmvaxpe',
    },
    {
        name: 'Username + Password',
        username: 'ftmvaxpe',
        password: 'f_9148jjTJ2EYi4Rz3tVTblkQGLHhOai',
    },
    {
        name: 'Username with vhost (ftmvaxpe:ftmvaxpe)',
        username: 'ftmvaxpe:ftmvaxpe',
        password: 'f_9148jjTJ2EYi4Rz3tVTblkQGLHhOai',
    },
];
async function testConnection(testConfig, customBrokerUrl) {
    const urlToUse = customBrokerUrl || brokerUrl;
    return new Promise((resolve) => {
        console.log(`\n🧪 Testing: ${testConfig.name}`);
        console.log(`   Broker: ${urlToUse}`);
        console.log(`   Username: ${testConfig.username || 'none'}`);
        console.log(`   Password: ${testConfig.password ? '***' : 'none'}`);
        const connectOptions = {
            clientId: clientId + '-' + Date.now(),
            clean: true,
            connectTimeout: 10000,
            keepalive: 60,
            protocolVersion: 4,
        };
        if (testConfig.username) {
            connectOptions.username = testConfig.username;
        }
        if (testConfig.password) {
            connectOptions.password = testConfig.password;
        }
        const client = mqtt_1.default.connect(urlToUse, connectOptions);
        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                client.end();
                console.log('   ❌ Connection timeout (10s)');
                resolve(false);
            }
        }, 10000);
        client.on('connect', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                console.log('   ✅ Connected successfully!');
                client.end();
                resolve(true);
            }
        });
        client.on('error', (error) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                console.log(`   ❌ Error: ${error.message}`);
                client.end();
                resolve(false);
            }
        });
        client.on('close', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                console.log('   ❌ Connection closed');
                resolve(false);
            }
        });
    });
}
async function main() {
    console.log('🔍 MQTT Connection Diagnostic Tool');
    console.log('=====================================\n');
    console.log(`Broker: ${brokerUrl}`);
    console.log(`Client ID: ${clientId}\n`);
    console.log('📡 Step 1: Testing with public broker (test.mosquitto.org)...');
    const publicBrokerUrl = 'mqtt://test.mosquitto.org:1883';
    const publicTest = await new Promise((resolve) => {
        const testConfig = {
            name: 'Public broker (no auth)',
        };
        console.log(`\n🧪 Testing: ${testConfig.name}`);
        console.log(`   Broker: ${publicBrokerUrl}`);
        console.log(`   Username: none`);
        console.log(`   Password: none`);
        const connectOptions = {
            clientId: clientId + '-public-' + Date.now(),
            clean: true,
            connectTimeout: 10000,
            keepalive: 60,
            protocolVersion: 4,
        };
        const client = mqtt_1.default.connect(publicBrokerUrl, connectOptions);
        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                client.end();
                console.log('   ❌ Connection timeout (10s)');
                resolve(false);
            }
        }, 10000);
        client.on('connect', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                console.log('   ✅ Connected successfully!');
                client.end();
                resolve(true);
            }
        });
        client.on('error', (error) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                console.log(`   ❌ Error: ${error.message}`);
                client.end();
                resolve(false);
            }
        });
        client.on('close', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                console.log('   ❌ Connection closed');
                resolve(false);
            }
        });
    });
    if (publicTest) {
        console.log('\n✅ Public broker test passed - your code works!');
    }
    else {
        console.log('\n❌ Public broker test failed - check network/firewall');
        process.exit(1);
    }
    console.log('\n📡 Step 2: Testing CloudAMQP with different configurations...');
    let success = false;
    for (const testConfig of testConfigs) {
        const result = await testConnection(testConfig);
        if (result) {
            success = true;
            console.log(`\n✅ SUCCESS with configuration: ${testConfig.name}`);
            console.log(`   Use these settings in your .env:`);
            console.log(`   MQTT_USERNAME=${testConfig.username || ''}`);
            console.log(`   MQTT_PASSWORD=${testConfig.password || ''}`);
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!success) {
        console.log('\n❌ All CloudAMQP tests failed');
        console.log('\n🔍 Troubleshooting steps:');
        console.log('1. Check CloudAMQP dashboard - is MQTT plugin enabled?');
        console.log('2. Verify instance is running (not paused)');
        console.log('3. Check credentials in CloudAMQP dashboard');
        console.log('4. Verify port 1883 is open');
        console.log('5. Check if your CloudAMQP plan supports MQTT');
        process.exit(1);
    }
    process.exit(0);
}
main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=testMQTTConnection.js.map