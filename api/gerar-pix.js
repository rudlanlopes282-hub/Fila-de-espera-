const axios = require('axios');

const CLIENT_ID = "1072c932-71d8-49ce-8d2d-d1111e936460";
const CLIENT_SECRET = "1b221f82-ad1a-46ef-99ef-20fabfad9832";
const BASE_URL = "https://api.syncpayments.com.br/api/partner/v1";

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { name, email, cpf, amount } = req.body || {};

    const chargeAmount = amount ? parseFloat(amount) : 6.90;

    let cleanDoc = (cpf || "").replace(/\D/g, '');
    let docToSubmit = cleanDoc;

    if (!docToSubmit || docToSubmit.length < 11) {
      docToSubmit = "11122233344";
    }

    // 1. Autenticação na API SyncPay
    const authRes = await axios.post(`${BASE_URL}/auth-token`, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    const token = authRes.data.access_token || authRes.data.token;

    if (!token) {
      return res.status(400).json({ error: "Falha ao obter token na SyncPay" });
    }

    // 2. Requisição para emissão de PIX Cash-In
    const pixRes = await axios.post(`${BASE_URL}/cash-in`, {
      amount: chargeAmount,
      description: "Taxa de Verificacao de Fila",
      client: {
        name: name || "Cliente",
        email: email || "cliente@email.com",
        cpf: docToSubmit
      }
    }, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = pixRes.data;
    const pixCode = data.pix_code || data.qrcode || data.emv || (data.data && (data.data.pix_code || data.data.qrcode || data.data.emv));

    if (!pixCode) {
      return res.status(400).json({ 
        error: "Resposta da API sem código PIX válido", 
        response: data 
      });
    }

    return res.status(200).json({ pix_code: pixCode });
  } catch (error) {
    console.error("Erro na integração SyncPay:", error.response?.data || error.message);
    return res.status(500).json({ 
      error: "Erro ao processar cobrança via API",
      details: error.response?.data || error.message 
    });
  }
};
