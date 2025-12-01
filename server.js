const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

// Caminhos
const packsFilePath = path.join(__dirname, "data", "data.json");
const passwordPath = path.join(__dirname, "data", "password.json");

// Secret para JWT (gera automaticamente se não existir)
const JWT_SECRET = process.env.JWT_SECRET || "seu-secret-jwt-super-seguro-mude-isso";

// Configura pasta pública e JSON
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static("public"));

// Lê senha de autenticação
let uploadPassword = "seu-senha-segura-aqui";
try {
    const pwdData = JSON.parse(fs.readFileSync(passwordPath));
    uploadPassword = pwdData.uploadPassword || uploadPassword;
} catch (err) {
    console.warn("Aviso: password.json não encontrado");
}

// Middleware de autenticação
const authenticate = (req, res, next) => {
    const password = req.headers['x-upload-password'] || req.body?.password;
    if (password !== uploadPassword) {
        return res.status(401).json({ error: "Senha incorreta" });
    }
    next();
};

// Middleware de verificação de token JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1] || req.body?.token;
    
    if (!token) {
        return res.status(401).json({ error: "Token não fornecido" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Token inválido ou expirado" });
    }
};

// Configurar multer
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const packId = req.body.packId || req.query.packId;
        const packDir = path.join(uploadsDir, packId);
        if (!fs.existsSync(packDir)) {
            fs.mkdirSync(packDir, { recursive: true });
        }
        cb(null, packDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// Rota admin
app.get("/admin.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Login - gera token JWT
app.post("/api/login", (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: "Senha é obrigatória" });
    }

    if (password !== uploadPassword) {
        return res.status(401).json({ error: "Senha incorreta" });
    }

    // Gera token válido por 24 horas
    const token = jwt.sign(
        { admin: true, loginTime: new Date() },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({ success: true, token, expiresIn: '24h' });
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

// Incrementar contagem de downloads
app.post("/api/download/:id", (req, res) => {
    try {
        let packs = JSON.parse(fs.readFileSync(packsFilePath));
        const pack = packs.find(p => p.id === req.params.id);
        
        if (!pack) {
            return res.status(404).json({ error: "Pack não encontrado" });
        }
        
        // Incrementa contador
        if (!pack.downloads) pack.downloads = 0;
        pack.downloads += 1;
        
        // Salva arquivo atualizado
        fs.writeFileSync(packsFilePath, JSON.stringify(packs, null, 2));
        
        res.json({ success: true, downloads: pack.downloads });
    } catch (err) {
        res.status(500).json({ error: "Erro ao atualizar downloads" });
    }
});

// Adicionar novo pack
app.post("/api/packs", verifyToken, (req, res) => {
    try {
        const { id, name, creator, description, version, resolution, download, icon, screenshot } = req.body;
        
        // Validação básica
        if (!id || !name || !creator || !download) {
            return res.status(400).json({ error: "Campos obrigatórios: id, name, creator, download" });
        }
        
        let packs = JSON.parse(fs.readFileSync(packsFilePath));
        
        // Verifica se pack já existe
        if (packs.find(p => p.id === id)) {
            return res.status(409).json({ error: "Pack com esse ID já existe" });
        }
        
        // Cria novo pack
        const newPack = {
            id,
            name,
            creator,
            resolution: resolution || ["medium"],
            download,
            description: description || "",
            version: version || "v1.0.0",
            icon: icon || "/img/default-icon.png",
            screenshot: screenshot || "/img/default-screenshot.png",
            downloads: 0
        };
        
        packs.push(newPack);
        fs.writeFileSync(packsFilePath, JSON.stringify(packs, null, 2));
        
        res.status(201).json({ success: true, pack: newPack });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao adicionar pack" });
    }
});

// Upload de arquivos (ZIP, ícone, screenshot)
app.post("/api/upload", verifyToken, upload.fields([
    { name: 'zipFile', maxCount: 1 },
    { name: 'icon', maxCount: 1 },
    { name: 'screenshot', maxCount: 1 }
]), (req, res) => {
    try {
        const { packId } = req.body;
        if (!packId) {
            return res.status(400).json({ error: "packId é obrigatório" });
        }

        const uploads = {};
        if (req.files?.zipFile?.[0]) uploads.zip = `/uploads/${packId}/${req.files.zipFile[0].filename}`;
        if (req.files?.icon?.[0]) uploads.icon = `/uploads/${packId}/${req.files.icon[0].filename}`;
        if (req.files?.screenshot?.[0]) uploads.screenshot = `/uploads/${packId}/${req.files.screenshot[0].filename}`;

        res.json({ success: true, uploads });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao fazer upload" });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
