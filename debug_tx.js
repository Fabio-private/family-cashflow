
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Try to find .env file
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking family_members...");
    const { data: members, error: mErr } = await supabase.from('family_members').select('*');
    if (mErr) console.error("Members error:", mErr);
    else console.table(members);

    const giulia = members.find(m => m.name === 'Giulia');
    if (giulia) {
        console.log(`Checking transactions for Giulia (ID: ${giulia.id})...`);
        const { data: txs, error: txErr } = await supabase
            .from('transactions')
            .select('*')
            .or(`payer_id.eq.${giulia.id},beneficiary_id.eq.${giulia.id}`);

        if (txErr) console.error("Transactions error:", txErr);
        else {
            console.log(`Found ${txs.length} transactions for Giulia.`);
            console.table(txs);
        }
    } else {
        console.log("Giulia not found in family_members");
    }
}

check();
