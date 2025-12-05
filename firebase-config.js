// ------------------------------------------------------------------
// PASO 1: Ve a https://console.firebase.google.com/
// PASO 2: Selecciona tu proyecto "Venus Estética"
// PASO 3: Ve a Configuración del Proyecto (icono de engranaje)
// PASO 4: Baja hasta "Tus aplicaciones" y selecciona la app Web (</>)
// PASO 5: Copia el objeto 'firebaseConfig' que te dan y REEMPLAZA el de abajo.
// ------------------------------------------------------------------

const firebaseConfig = {
    apiKey: "AIzaSyAIefMn0_5wFcDW8hWsYdyDCm5g3hklLYA",
    authDomain: "venusesteticaspapersonal.firebaseapp.com",
    projectId: "venusesteticaspapersonal",
    storageBucket: "venusesteticaspapersonal.firebasestorage.app",
    messagingSenderId: "1072261878296",
    appId: "1:1072261878296:web:f2d229eaf5156e841a296d",
    measurementId: "G-MT5VF8L1FF"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    var db = firebase.firestore();
    var auth = firebase.auth(); // Make auth available globally if needed
} else {
    console.error("Firebase SDK not loaded.");
}
