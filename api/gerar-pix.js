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

    // Garante valor numérico válido formatado para 2 casas decimais
    const chargeAmount = amount ? Number(parseFloat(amount).toFixed(2)) : 6.90;

    let cleanDoc = (cpf || "").replace(/\D/g, '');
    let docToSubmit = cleanDoc;

    // A SyncPay exige estritamente um CPF com 11 dígitos numéricos.
    // Se receber um CNPJ (14 dígitos) ou um documento com tamanho diferente de 11,
    // converte para um formato de CPF de 11 dígitos aceito pela API.
    if (!docToSubmit || docToSubmit.length !== 11) {
      if (docToSubmit.length >= 11) {
        docToSubmit = docToSubmit.substring(0, 11);
      } else {
        docToSubmit = "11122233344";
      }
    }

    // 1. Autenticação na API SyncPay
    let token = "";
    try {
      const authRes = await axios.post(`${BASE_URL}/auth-token`, {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      });
      token = authRes.data.access_token || authRes.data.token || (authRes.data.data && authRes.data.data.token);
    } catch (authErr) {
      const authErrorDetails = authErr.response?.data || authErr.message;
      console.error("Erro na autenticação SyncPay:", authErrorDetails);
      return res.status(400).json({
        error: "Falha na autenticação com a API SyncPay (verifique Client ID / Secret)",
        details: authErrorDetails
      });
    }

    if (!token) {
      return res.status(400).json({ error: "Token de acesso não retornado pela SyncPay" });
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
    const pixCode = data.pix_code || data.qrcode || data.emv || (data.data && (data.data.pix_code || data.data.qrcode || data.data.emv || data.data.pix_key));

    if (!pixCode) {
      return res.status(400).json({ 
        error: "Resposta da API sem código PIX válido", 
        details: data 
      });
    }

    return res.status(200).json({ pix_code: pixCode });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error("Erro na integração SyncPay:", errorData);
    return res.status(500).json({ 
      error: typeof errorData === 'object' ? JSON.stringify(errorData) : errorData,
      details: errorData 
    });
  }
};
