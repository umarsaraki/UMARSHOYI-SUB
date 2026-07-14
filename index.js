import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FLW_SECRET = process.env.FLW_SECRET;

const KEYS = {
  AIRTIME: process.env.NELLobyte_AIRTIME,
  DATA: process.env.NELLobyte_DATA,
  CABLE: process.env.NELLobyte_CABLE,
  LIGHT: process.env.NELLobyte_LIGHT,
  AIRTIME_CARD: process.env.NELLobyte_AIRTIME_CARD,
  DATA_CARD: process.env.NELLobyte_DATA_CARD,
  WAEC: process.env.NELLobyte_WAEC,
  JAMB: process.env.NELLobyte_JAM,
  USER: process.env.NELLobyte_USER,
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.get("/", (req, res) => {
  res.json({ status: "Server is running", time: new Date() });
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/api/pay", async (req, res) => {
  try {
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FLW_SECRET}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
