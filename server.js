import { createClient } from '@supabase/supabase-js';
import http from 'http';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PROFIT = { per_gb: 50, cable: 100, light: 50, exam: 100, card: 50 };
const KEYS = {
  airtime: process.env.NELLobyte_AIRTIME,
  data: process.env.NELLobyte_DATA,
  cable: process.env.NELLobyte_CABLE,
  light: process.env.NELLobyte_LIGHT,
  waec: process.env.NELLobyte_WAEC,
  jam: process.env.NELLobyte_JAM,
  airtime_card: process.env.NELLobyte_AIRTIME_CARD,
  data_card: process.env.NELLobyte_DATA_CARD
};
const USER_ID = process.env.NELLobyte_USER;

// Helper Functions
async function verifyPin(user_id, pin) {
  const { data } = await supabase.from('wallets').select('transaction_pin').eq('user_id', user_id).single();
  return data?.transaction_pin === pin;
}

async function deductWallet(user_id, amount) {
  const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user_id).single();
  if(!wallet || wallet.balance < amount) return {success: false};
  await supabase.from('wallets').update({ balance: wallet.balance - amount }).eq('user_id', user_id);
  return {success: true};
}

// Server Setup
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', async () => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const type = url.searchParams.get("type");
      const jsonBody = body ? JSON.parse(body) : {};

      if (type === "buy_data") {
        const { user_id, pin, phone, plan_code, amount, plan_name } = jsonBody;
        const gb = parseFloat(plan_name.match(/([\d.]+)\s*GB/i)?.[1] || 1);
        const total = Number(amount) + (gb * PROFIT.per_gb);
        
        if (!await verifyPin(user_id, pin)) return res.end(JSON.stringify({success: false, message: "Wrong PIN"}));
        if (!(await deductWallet(user_id, total)).success) return res.end(JSON.stringify({success: false, message: "Insufficient Balance"}));
        
        const apiRes = await fetch(`https://www.nellobytesystems.com/APIDatabundleNetworkV2.asp?UserID=${USER_ID}&APIKey=${KEYS.data}&mobile=${phone}&plan=${plan_code}`);
        res.end(JSON.stringify(await apiRes.json()));
      } else {
        res.end(JSON.stringify({message: "API Working"}));
      }
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({error: e.message}));
    }
  });
});

server.listen(process.env.PORT || 10000);
