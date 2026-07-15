import { createClient } from '@supabase/supabase-js';
import http from 'http';
import fetch from 'node-fetch'; // Na dawo da shi nan domin tabbatar da ya yi aiki

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FLW_SECRET = process.env.FLW_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PROFIT = { per_gb: 50, cable: 100, light: 50, exam: 100, card: 50 };

const KEYS = {
  flw_secret: FLW_SECRET,
  airtime: process.env.NELLobyte_AIRTIME,
  data: process.env.NELLobyte_DATA,
  cable: process.env.NELLobyte_CABLE,
  light: process.env.NELLobyte_LIGHT,
  airtime_card: process.env.NELLobyte_AIRTIME_CARD,
  data_card: process.env.NELLobyte_DATA_CARD,
  waec: process.env.NELLobyte_WAEC,
  jam: process.env.NELLobyte_JAM,
};
const USER_ID = process.env.NELLobyte_USER;

async function verifyPin(user_id, pin) {
  const { data } = await supabase.from('wallets').select('transaction_pin').eq('user_id', user_id).single();
  return data?.transaction_pin === pin;
}

async function saveHistory(user_id, amount, type, service, status, details) {
  await supabase.from('transactions').insert({
    user_id, amount: type === "debit" ? -amount : amount, type, service, status, details, created_at: new Date().toISOString()
  });
}

async function deductWallet(user_id, amount) {
  const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user_id).single();
  if(!wallet || wallet.balance < amount) return {success: false, message: "Insufficient balance"};
  const newBalance = wallet.balance - amount;
  await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', user_id);
  return {success: true, new_balance: newBalance};
}

async function creditWallet(user_id, amount) {
  const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user_id).single();
  const newBalance = (wallet?.balance || 0) + amount;
  await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', user_id);
  return {success: true, new_balance: newBalance};
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', async () => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const type = url.searchParams.get("type");
      const jsonBody = body ? JSON.parse(body) : {};

      if(type === "get_balance"){
        const { data } = await supabase.from('wallets').select('balance').eq('user_id', jsonBody.user_id).single();
        res.writeHead(200); return res.end(JSON.stringify({success: true, balance: data?.balance || 0}));
      }

      if(type === "data_plans"){
        const resApi = await fetch(`https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${USER_ID}&APIKey=${KEYS.data}`);
        const plans = await resApi.json();
        const result = plans.map((p) => {
          const gbMatch = p.plan_name.match(/([\d.]+)\s*GB/i);
          const gb = gbMatch ? parseFloat(gbMatch[1]) : 1;
          const selling_price = Number(p.amount) + (gb * PROFIT.per_gb);
          return {...p, selling_price: selling_price};
        });
        res.writeHead(200); return res.end(JSON.stringify({success: true, data: result}));
      }

      if(type === "buy_data"){
        const { user_id, pin, phone, plan_code, amount, plan_name, network } = jsonBody;
        const gb = parseFloat(plan_name.match(/([\d.]+)\s*GB/i)?.[1] || 1);
        const selling_amount = Number(amount) + (gb * PROFIT.per_gb);
        
        if(!await verifyPin(user_id, pin)) { res.writeHead(401); return res.end(JSON.stringify({success: false, message: "Wrong PIN"})); }
        const deduct = await deductWallet(user_id, selling_amount);
        if(!deduct.success) { res.writeHead(400); return res.end(JSON.stringify(deduct)); }
        
        await saveHistory(user_id, selling_amount, "debit", "Data", "pending", {phone, plan_code});
        const resApi = await fetch(`https://www.nellobytesystems.com/APIDatabundleNetworkV2.asp?UserID=${USER_ID}&APIKey=${KEYS.data}&mobile=${phone}&plan=${plan_code}`);
        const result = await resApi.json();
        await supabase.from('transactions').update({status: result.status === "success" ? "success" : "rejected"}).eq('user_id', user_id).eq('status', 'pending');
        res.writeHead(200); return res.end(JSON.stringify(result));
      }
      
      // ... Sauran logic ɗinka sun zauna yadda suke...
      res.writeHead(400); res.end(JSON.stringify({success: false, message: "Invalid type"}));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({success: false, error: e.message}));
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
