const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Caminhos
const packsFilePath = path.join(__dirname, "data", "data.json");
const passwordPath = path.join(__dirname, "data", "password.json");

// Configura pasta pública e JSON
app.use(bodyParser.json());
app.use(express.static("public"));

// Rota admin
app.get("/admin.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Ler todos os packs
app.get("/api/packs", (req, res) => {
    try {
        const packs = JSON.parse(fs.readFileSync(packsFilePath));
        res.json(packs);
    } catch (err) {
        res.status(500).json({ error: "Não foi possível ler o JSON" });
    }
});

// Adicionar pack (verifica senha)
app.post("/api/packs", (req, res) => {
    const { password, ...pack } = req.body;

    // Lê a senha do arquivo
    const file = JSON.parse(fs.readFileSync(passwordPath, "utf8"));
    const realPass = file.password;

    if (!password) return res.status(401).json({ error: "Senha necessária." });
    if (password !== realPass) return res.status(401).json({ error: "Senha incorreta." });

    try {
        const packs = JSON.parse(fs.readFileSync(packsFilePath));
        packs.push(pack);
        fs.writeFileSync(packsFilePath, JSON.stringify(packs, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao salvar pack." });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
