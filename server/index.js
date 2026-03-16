const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Inicialización de Firebase Admin
// Se espera que las credenciales estén en variables de entorno en Render
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
    console.warn("ADVERTENCIA: FIREBASE_SERVICE_ACCOUNT no encontrada. El backend no podrá limpiar la base de datos.");
}

const db = admin.firestore ? admin.firestore() : null;

// Endpoint de Ping para Cron-Job.org (Mantiene vivo a Render cada 5 min)
app.get('/ping', (req, res) => {
    console.log("Ping recibido a las:", new Date().toLocaleString());
    res.status(200).send("Venus SPA Backend is Alive!");
});

// Endpoint principal
app.get('/', (req, res) => {
    res.send("Venus SPA Backend - Operativo");
});

// Lógica de Limpieza de Citas Antiguas
app.get('/cleanup', async (req, res) => {
    if (!db) return res.status(500).send("Base de datos no inicializada.");

    try {
        console.log("Iniciando limpieza de horarios antiguos...");
        
        // Obtener fecha de hoy en formato YYYY-MM-DD
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // Buscamos horarios con fecha menor a la de hoy
        const snapshot = await db.collection('horarios')
            .where('date', '<', todayStr)
            .get();

        if (snapshot.empty) {
            console.log("No hay horarios antiguos para limpiar.");
            return res.status(200).send("No hay nada que limpiar.");
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Limpieza completada. Se eliminaron ${snapshot.size} registros.`);
        res.status(200).send(`Limpieza exitosa. ${snapshot.size} registros eliminados.`);
        
    } catch (error) {
        console.error("Error en cleanup:", error);
        res.status(500).send("Error interno en la limpieza.");
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
