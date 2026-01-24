const { FABRIC_DATABASE, FABRIC_Q } = require('./fabricDatabase.js');

console.log("🔄 Verifying Database Sync...\n");

const dbKeys = new Set(Object.keys(FABRIC_DATABASE));
const qKeys = new Set(Object.keys(FABRIC_Q));

const missingInDB = [...qKeys].filter(k => !dbKeys.has(k));

if (missingInDB.length === 0) {
    console.log("✅ SUCCESS: All scored fabrics have UI descriptions.");
} else {
    console.error("❌ FAILURE: The following fabrics are scorable but missing UI text:");
    missingInDB.forEach(k => console.log(`   - ${k}`));
}
