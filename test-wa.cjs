const fs = require('fs');
const dotenv = require('dotenv');

// Load environment from .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'))
for (const k in envConfig) {
  process.env[k] = envConfig[k]
}

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0'
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID

async function testWhatsapp() {
  console.log('Testing WhatsApp API...');
  console.log('PHONE_NUMBER_ID:', PHONE_NUMBER_ID);
  
  // Replace with the user's personal number to test
  // In WhatsApp sandbox/developer accounts, you usually have to send to a registered test number first.
  const toPhoneNumber = process.argv[2] || process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  
  if (!toPhoneNumber) {
    console.error('Proporciona un número de teléfono destino como argumento. Ej: node test-wa.js 595981xxxxxx')
    process.exit(1);
  }

  console.log('Sending message to:', toPhoneNumber);
  
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhoneNumber,
        type: 'text',
        text: {
          preview_url: false,
          body: '¡Hola! Este es un mensaje de prueba desde tu sistema 4G Celulares 🚀'
        }
      })
    });

    const data = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  }
}

testWhatsapp();
