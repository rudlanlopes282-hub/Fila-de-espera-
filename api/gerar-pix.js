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

    // 1. Obter Token de Autenticação
    const authRes = await axios.post(`${BASE_URL}/auth-token`, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    const token = authRes.data.access_token || authRes.data.token;

    if (!token) {
      return res.status(400).json({ error: "Falha ao obter token na SyncPay" });
    }

    // 2. Gerar Cobrança Pix (Cash-in)
    const pixRes = await axios.post(`${BASE_URL}/cash-in`, {
      amount: chargeAmount,
      description: "Taxa de Verificacao TikTok",
      client: {
        name: name || "Cliente",
        email: email,
        cpf: cpf ? cpf.replace(/\D/g, '') : "00000000000"
      }
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const pixCode = pixRes.data.pix_code || pixRes.data.qrcode || pixRes.data.emv;

    return res.status(200).json({ pix_code: pixCode });
  } catch (error) {
    console.error("Erro na integração SyncPay:", error.response?.data || error.message);
    return res.status(500).json({ 
      error: error.response?.data?.message || error.response?.data || error.message 
    });
  }
};
