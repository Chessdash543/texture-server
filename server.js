const express = require("express");
const bodyParser = require("body-parser");
const basicAuth = require("basic-auth");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// Pasta de uploads
const iconStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public/uploads/icons"),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const screenshotStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public/uploads/screenshots"),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({
    storage: multer.diskStorage({}),
});

const uploadFields = multer().fields([
    { name: "icon", maxCount: 1 },
    { name: "screenshot", maxCount: 1 }
]);

const packsFilePath = path.join(__dirname, "data", "data.json");

function auth(req, res, next) {
    const user = basicAuth(req);
    if (!user || user.name !== adminUser || user.pass !== adminPass) {
        res.set("WWW-Authenticate", 'Basic realm="Admin Area"');
        return res.status(401).send("Autenticação necessária.");
    }
    next();
}

app.use(bodyParser.json());
app.use(express.static("public"));

// Rota admin
app.get("/admin.html", auth, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Ler packs
app.get("/api/packs", (req, res) => {
    try {
        const packs = JSON.parse(fs.readFileSync(packsFilePath));
        res.json(packs);
    } catch (err) {
        res.status(500).json({ error: "Não foi possível ler o JSON" });
    }
});

// Adicionar pack com upload
const uploadMulter = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            if(file.fieldname === "icon") cb(null, "public/uploads/icons");
            else cb(null, "public/uploads/screenshots");
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + "-" + file.originalname);
        }
    })
});

app.post("/api/packs", async (req, res) => {
  const { password, ...pack } = req.body;

  if (!password) return res.status(401).json({ error: "Senha necessária." });

  const ok = await bcrypt.compare(password, adminHash);
  if (!ok) return res.status(401).json({ error: "Senha incorreta." });

  try {
    // Lê o JSON correto
    const packs = JSON.parse(fs.readFileSync(packsFilePath));

    // Adiciona ao array
    packs.push(pack);

    // Salva
    fs.writeFileSync(packsFilePath, JSON.stringify(packs, null, 2));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar pack." });
  }
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
