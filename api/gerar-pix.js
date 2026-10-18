const axios = require('axios');

const CLIENT_ID = "1072c932-71d8-49ce-8d2d-d1111e936460";
const CLIENT_SECRET = "1b221f82-ad1a-46ef-99ef-20fabfad9832";
const BASE_URL = "https://api.syncpayments.com.br/api/partner/v1";

async function getAuthToken() {
  const authUrl = `${BASE_URL}/auth-token`.trim();
  const authRes = await axios.post(authUrl, {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  });
  return authRes.data.access_token || authRes.data.token || (authRes.data.data && authRes.data.data.token);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Consulta o status do pagamento pelo ID da transação
  if (req.method === 'GET') {
    try {
      const { id } = req.query || {};
      if (!id) {
        return res.status(400).json({ error: 'ID da transação não informado' });
      }

      const token = await getAuthToken();
      const statusUrl = `${BASE_URL}/cash-in/${id}`.trim();

      const statusRes = await axios.get(statusUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = statusRes.data;
      const status = data.status || (data.data && data.data.status) || 'PENDING';
      const isPaid = ['PAID', 'APPROVED', 'COMPLETED', 'CONFIRMED'].includes(status.toUpperCase());

      return res.status(200).json({
        id: id,
        status: status,
        paid: isPaid
      });
    } catch (err) {
      console.error("Erro na verificação de status SyncPay:", err.response?.data || err.message);
      return res.status(200).json({ paid: false, status: 'PENDING' });
    }
  }

  // POST: Geração de cobrança PIX
  if (req.method === 'POST') {
    try {
      const { name, email, cpf, amount } = req.body || {};

      const chargeAmount = amount ? Number(parseFloat(amount).toFixed(2)) : 6.90;

      let cleanDoc = (cpf || "").replace(/\D/g, '');
      let docToSubmit = cleanDoc;

      if (!docToSubmit || docToSubmit.length !== 11) {
        if (docToSubmit.length >= 11) {
          docToSubmit = docToSubmit.substring(0, 11);
        } else {
          docToSubmit = "11122233344";
        }
      }

      const token = await getAuthToken();
      if (!token) {
        return res.status(400).json({ error: "Token de acesso não retornado pela SyncPay" });
      }

      const cashInUrl = `${BASE_URL}/cash-in`.trim();
      const pixRes = await axios.post(cashInUrl, {
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
      const identifier = data.identifier || data.id || (data.data && (data.data.identifier || data.data.id));

      if (!pixCode) {
        return res.status(400).json({ 
          error: "Resposta da API sem código PIX válido", 
          details: data 
        });
      }

      return res.status(200).json({
        pix_code: pixCode,
        identifier: identifier
      });
    } catch (error) {
      const errorData = error.response?.data || error.message;
      console.error("Erro na integração SyncPay:", errorData);
      return res.status(500).json({ 
        error: typeof errorData === 'object' ? JSON.stringify(errorData) : errorData,
        details: errorData 
      });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
};
