// --- Setup ---
// Rely on global 'db' and 'storage' from firebase-config.js.
// We verify they exist to avoid silent failures.
if (!window.db) {
    console.error("Database not initialized! Check firebase-config.js");
    alert("Error crítico: Base de datos no conectada. Revisa la consola.");
}

// Auth Guard & Redirect
if (firebase.auth()) {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            try {
                // Check role
                const doc = await db.collection('users').doc(user.uid).get();
                const role = doc.exists ? (doc.data().role || '').toLowerCase() : '';

                if (role !== 'admin' && role !== 'administrador') {
                    alert('Acceso Denegado.');
                    window.location.href = 'index.html';
                } else {
                    console.log("Admin logged in");
                    // Ensure the DOM is fully loaded before init
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', initAdmin);
                    } else {
                        initAdmin();
                    }
                }
            } catch (e) {
                console.error("Auth Error", e);
                // Fallback specific for dev: allow access if DB fails but user is auth
                // alert("Error verificando rol: " + e.message);
            }
        } else {
            window.location.href = 'index.html';
        }
    });
}

function logout() {
    firebase.auth().signOut().then(() => window.location.href = 'index.html');
}

// --- Initialization ---
function initAdmin() {
    loadProductos();
    loadServicios();
    loadCitas();
    loadPromos();
    loadPedidos();
    // Default date for schedule
    const dateInput = document.getElementById('schedule-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
        loadDaySchedule(); // Load today by default
    }
    cleanupOldCitas(); // Auto-cleanup on load
}

// Auto-cleanup Cancelled Citas older than 24h (by date)
async function cleanupOldCitas() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1); // Yesterday

    try {
        const snapshot = await db.collection('citas').where('status', '==', 'Cancelada').get();
        if (snapshot.empty) return;

        const batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.date) {
                // Parse YYYY-MM-DD
                const parts = data.date.split('-'); // [2025, 12, 06] - Careful with timezone, but good enough for this
                // Create date object in local time (browser default) 
                // Note: new Date('2025-12-06') is UTC usually.
                // Let's use simple string comparison for YYYY-MM-DD if possible or proper parsing.
                const appDate = new Date(data.date + 'T00:00:00');

                if (appDate < cutoff) {
                    batch.delete(doc.ref);
                    count++;
                }
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`Auto-cleaned ${count} old cancelled appointments.`);
            loadCitas(); // Refresh table if needed
        }
    } catch (e) {
        console.error("Error auto-cleaning citas:", e);
    }
}

// --- Tabs (Tailwind Logic) ---
function switchTab(tabId) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('block');
    });

    // Reset tabs styles
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'text-gold', 'border-b-2', 'border-gold', 'bg-gold-light');
        btn.classList.add('text-gray-500', 'hover:text-gold');
    });

    // Show active section
    const section = document.getElementById(`section-${tabId}`);
    if (section) {
        section.classList.remove('hidden');
        section.classList.add('block');
    }

    // Style active tab
    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) {
        activeTab.classList.remove('text-gray-500', 'hover:text-gold');
        activeTab.classList.add('active', 'text-gold', 'border-b-2', 'border-gold', 'bg-gold-light');
    }
}

// --- Loaders (Tailwind Styled) ---

// Productos
function loadProductos() {
    const tbody = document.getElementById('productos-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">Cargando...</td></tr>';

    db.collection('productos').get().then(snapshot => {
        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">No hay productos.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const d = doc.data();
            const statusColor = (d.status === 'Disponible' || !d.status)
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800';
            const statusLabel = d.status || 'Disponible';

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <img src="${d.image}" alt="" class="h-10 w-10 rounded-full object-cover shadow-sm">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900">${d.name}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-500">${d.category}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-semibold text-gray-900">₡${d.price}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                         <div class="text-sm text-gray-500">${d.stock || 0}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button onclick="editProduct('${doc.id}', '${d.name}', '${d.price}', '${d.category}', '${d.image}', '${d.stock}', '${d.status}')" class="text-blue-600 hover:text-blue-900 mr-3"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteItem('productos', '${doc.id}')" class="text-red-600 hover:text-red-900"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }).catch(err => {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Error: ${err.message}</td></tr>`;
    });
}

// Servicios
window.allServices = []; // Cache for dropdowns

function loadServicios() {
    const tbody = document.getElementById('servicios-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Cargando...</td></tr>';

    db.collection('servicios').get().then(snapshot => {
        tbody.innerHTML = '';
        window.allServices = []; // Reset cache

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No hay servicios.</td></tr>';
            return;
        }
        snapshot.forEach(doc => {
            const d = doc.data();
            window.allServices.push(d.name); // Cache name
            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${d.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${d.category}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">₡${d.price}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button onclick="editService('${doc.id}', '${d.name}', '${d.price}', '${d.category}')" class="text-blue-600 hover:text-blue-900 mr-3"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteItem('servicios', '${doc.id}')" class="text-red-600 hover:text-red-900"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }).catch(err => tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Error: ${err.message}</td></tr>`);
}

// Promos
function loadPromos() {
    const tbody = document.getElementById('promos-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Cargando...</td></tr>';

    db.collection('promociones').get().then(snapshot => {
        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No hay promociones.</td></tr>';
            return;
        }
        snapshot.forEach(doc => {
            const d = doc.data();
            tbody.innerHTML += `
               <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <img src="${d.image}" alt="" class="h-10 w-10 rounded-md object-cover">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${d.title}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">₡${d.price}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                         <button onclick="editPromo('${doc.id}', '${d.title}', '${d.description}', '${d.price}', '${d.image}')" class="text-blue-600 hover:text-blue-900 mr-3"><i class="fas fa-edit"></i></button>
                         <button onclick="deleteItem('promociones', '${doc.id}')" class="text-red-600 hover:text-red-900"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }).catch(err => tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Error: ${err.message}</td></tr>`);
}

// Citas
function loadCitas() {
    const tbody = document.getElementById('citas-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Cargando...</td></tr>';

    db.collection('citas').orderBy('timestamp', 'desc').get().then(snapshot => {
        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500">No hay citas.</td></tr>';
            return;
        }
        snapshot.forEach(doc => {
            const d = doc.data();
            // Status colors
            let badgeClass = 'bg-gray-100 text-gray-800';
            if (d.status === 'Confirmada') badgeClass = 'bg-green-100 text-green-800';
            if (d.status === 'Cancelada') badgeClass = 'bg-red-100 text-red-800';
            if (d.status === 'Pendiente') badgeClass = 'bg-yellow-100 text-yellow-800';

            const timeDisplay = d.time || 'N/A';
            const emailDisplay = d.email || 'N/A';

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${d.date}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${timeDisplay}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${d.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${emailDisplay}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${d.service}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${d.phone}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}">
                            ${d.status}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                         <button onclick="editCita('${doc.id}', '${d.name}', '${d.service}', '${d.date}', '${d.phone}', '${d.status}', '${emailDisplay}', '${timeDisplay}')" class="text-blue-600 hover:text-blue-900 mr-3"><i class="fas fa-edit"></i></button>
                         <button onclick="deleteItem('citas', '${doc.id}')" class="text-red-600 hover:text-red-900"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }).catch(err => tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Error: ${err.message}</td></tr>`);
}

// Pedidos
function loadPedidos() {
    const tbody = document.getElementById('pedidos-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Cargando...</td></tr>';

    db.collection('pedidos').orderBy('timestamp', 'desc').get().then(snapshot => {
        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No hay pedidos.</td></tr>';
            return;
        }

        window.allPedidosCache = {}; // Cache for editing

        snapshot.forEach(doc => {
            const d = doc.data();
            window.allPedidosCache[doc.id] = d;

            const date = d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleDateString() : 'N/A';
            let badgeClass = 'bg-gray-100 text-gray-800';
            if (d.status === 'Confirmado') badgeClass = 'bg-blue-100 text-blue-800';
            if (d.status === 'Enviado') badgeClass = 'bg-yellow-100 text-yellow-800';
            if (d.status === 'Entregado') badgeClass = 'bg-green-100 text-green-800';

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${date}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${d.name || d.userId}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">₡${(d.total || 0).toLocaleString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                         <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}">
                            ${d.status}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button onclick="editPedido('${doc.id}')" class="text-blue-600 hover:text-blue-900 mr-3"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteItem('pedidos', '${doc.id}')" class="text-red-600 hover:text-red-900"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }).catch(err => tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Error: ${err.message}</td></tr>`);
}

function editPedido(id) {
    const d = window.allPedidosCache[id];
    if (!d) return;

    openAdminModal('Editar Pedido', 'pedidos');
    document.getElementById('edit-id').value = id;

    let itemsHtml = '<p class="text-gray-500 italic">Sin items</p>';
    if (d.items && d.items.length > 0) {
        itemsHtml = `
            <table class="min-w-full divide-y divide-gray-200 mb-4 border">
                <thead class="bg-gray-50">
                    <tr><th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th><th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Precio</th></tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${d.items.map(item => `
                        <tr>
                            <td class="px-3 py-2 text-sm text-gray-900">${item.name}</td>
                            <td class="px-3 py-2 text-sm text-gray-500">₡${item.price.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    document.getElementById('modal-fields').innerHTML = `
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Detalle de Productos</label>
            
            <div class="mb-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border">
                <strong>Método de Pago:</strong> ${d.paymentMethod || 'No especificado'}
            </div>

            ${itemsHtml}
            <div class="text-right font-bold text-lg">Total: ₡${(d.total || 0).toLocaleString()}</div>
        </div>
        <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700">Estado del Pedido</label>
            <select id="f-status" class="mt-1 block w-full border-gray-300 rounded-md border p-2">
                <option value="Pendiente">Pendiente</option>
                <option value="Confirmado">Confirmado</option>
                <option value="Enviado">Enviado</option>
                <option value="Entregado">Entregado</option>
            </select>
        </div>
    `;
    document.getElementById('f-status').value = d.status || 'Pendiente';
}


// --- Modals (Tailwind) ---

function openAdminModal(title, type) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('edit-type').value = type;
    document.getElementById('edit-id').value = '';

    // Reset Form
    const form = document.getElementById('admin-form');
    if (form) form.reset();

    // Show Modal
    document.getElementById('admin-modal').classList.remove('hidden');

    // Clear preview
    const preview = document.getElementById('upload-preview');
    if (preview) preview.classList.add('hidden');
}

function closeAdminModal() {
    document.getElementById('admin-modal').classList.add('hidden');
}

// Field Generators

// Productos
function openProductModal() {
    openAdminModal('Nuevo Producto', 'productos');
    document.getElementById('modal-fields').innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700">Nombre</label>
            <input type="text" id="f-name" class="mt-1 focus:ring-gold focus:border-gold block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border" required>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700">Categoría</label>
                <input type="text" id="f-category" class="mt-1 focus:ring-gold focus:border-gold block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border" required>
            </div>
            <div>
                 <label class="block text-sm font-medium text-gray-700">Stock</label>
                 <input type="number" id="f-stock" class="mt-1 focus:ring-gold focus:border-gold block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border" value="0">
            </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
             <div>
                <label class="block text-sm font-medium text-gray-700">Precio</label>
                <input type="number" id="f-price" class="mt-1 focus:ring-gold focus:border-gold block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border" required>
             </div>
             <div>
                <label class="block text-sm font-medium text-gray-700">Estado</label>
                <select id="f-status" class="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-gold focus:border-gold sm:text-sm">
                    <option value="Disponible">Disponible</option>
                    <option value="Agotado">Agotado</option>
                </select>
             </div>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700">Imagen</label>
            <input type="file" id="f-file" accept="image/*" onchange="previewImage(this)" class="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-gold hover:file:bg-yellow-100">
            <input type="hidden" id="f-image">
             <div id="upload-preview" class="mt-2 hidden text-center">
                <img id="preview-img" src="" class="h-20 rounded-md object-cover inline-block">
            </div>
        </div>
    `;
}

function editProduct(id, name, price, category, image, stock, status) {
    openProductModal();
    document.getElementById('modal-title').textContent = 'Editar Producto';
    document.getElementById('edit-id').value = id;
    document.getElementById('f-name').value = name;
    document.getElementById('f-price').value = price;
    document.getElementById('f-category').value = category;
    document.getElementById('f-stock').value = stock || 0;
    document.getElementById('f-status').value = status || 'Disponible';
    document.getElementById('f-image').value = image;

    if (image) {
        document.getElementById('upload-preview').classList.remove('hidden');
        document.getElementById('preview-img').src = image;
    }
}

// Servicios
function openServiceModal() {
    openAdminModal('Nuevo Servicio', 'servicios');
    document.getElementById('modal-fields').innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700">Nombre</label>
            <input type="text" id="f-name" class="mt-1 block w-full border-gray-300 rounded-md border p-2" required>
        </div>
         <div>
            <label class="block text-sm font-medium text-gray-700">Precio</label>
            <input type="number" id="f-price" class="mt-1 block w-full border-gray-300 rounded-md border p-2" required>
        </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Categoría</label>
            <select id="f-category" class="mt-1 block w-full border-gray-300 rounded-md border p-2">
                <option value="Tratamientos Faciales">Faciales</option>
                <option value="Tratamientos Corporales">Corporales</option>
                <option value="Masajes y Spa">Masajes</option>
                <option value="Depilación y Exfoliación">Depilación</option>
            </select>
        </div>
    `;
}
function editService(id, name, price, category) {
    openServiceModal();
    document.getElementById('modal-title').textContent = 'Editar Servicio';
    document.getElementById('edit-id').value = id;
    document.getElementById('f-name').value = name;
    document.getElementById('f-price').value = price;
    document.getElementById('f-category').value = category;
}

// Citas
function editCita(id, name, service, date, phone, status, email, time) {
    openAdminModal('Editar Cita', 'citas');

    // Populate service options from cache
    let serviceOptions = `<option value="${service}">${service} (Actual)</option>`;
    if (window.allServices && window.allServices.length > 0) {
        serviceOptions = window.allServices.map(s =>
            `<option value="${s}" ${s === service ? 'selected' : ''}>${s}</option>`
        ).join('');
    }

    document.getElementById('modal-fields').innerHTML = `
        <div class="grid grid-cols-2 gap-4">
             <div><label class="block text-sm text-gray-500">Cliente</label><div class="font-medium">${name}</div></div>
             <div><label class="block text-sm text-gray-500">Email</label><div class="font-medium truncate" title="${email}">${email}</div></div>
             <div><label class="block text-sm text-gray-500">Fecha</label><div class="font-medium">${date}</div></div>
             <div><label class="block text-sm text-gray-500">Hora</label><div class="font-medium">${time || 'N/A'}</div></div>
             <div><label class="block text-sm text-gray-500">Teléfono</label><div class="font-medium">${phone}</div></div>
        </div>
        <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700">Servicio</label>
            <select id="f-service" class="mt-1 block w-full border-gray-300 rounded-md border p-2">
                ${serviceOptions}
            </select>
        </div>
        <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700">Estado</label>
            <select id="f-status" class="mt-1 block w-full border-gray-300 rounded-md border p-2">
                <option value="Pendiente">Pendiente</option>
                <option value="Confirmada">Confirmada</option>
                <option value="Cancelada">Cancelada</option>
            </select>
        </div>
        <input type="hidden" id="f-name" value="${name}">
    `;
    document.getElementById('edit-id').value = id;
    document.getElementById('f-status').value = status;
}

// Promos
function openPromoModal() {
    openAdminModal('Nueva Promo', 'promociones');
    document.getElementById('modal-fields').innerHTML = `
        <div><label class="block text-sm font-medium text-gray-700">Título</label><input type="text" id="f-title" class="mt-1 w-full border p-2 rounded" required></div>
        <div><label class="block text-sm font-medium text-gray-700">Precio</label><input type="number" id="f-price" class="mt-1 w-full border p-2 rounded" required></div>
        <div><label class="block text-sm font-medium text-gray-700">Descripción</label><textarea id="f-description" class="mt-1 w-full border p-2 rounded"></textarea></div>
        <div>
            <label class="block text-sm font-medium text-gray-700">Imagen</label>
            <input type="file" id="f-file" accept="image/*" onchange="previewImage(this)" class="mt-1 block w-full">
            <input type="hidden" id="f-image">
             <div id="upload-preview" class="mt-2 hidden">
                <img id="preview-img" src="" class="h-20 rounded-md object-cover">
            </div>
        </div>
    `;
}
function editPromo(id, title, description, price, image) {
    openPromoModal();
    document.getElementById('modal-title').textContent = 'Editar Promo';
    document.getElementById('edit-id').value = id;
    document.getElementById('f-title').value = title;
    document.getElementById('f-price').value = price;
    document.getElementById('f-description').value = description;
    document.getElementById('f-image').value = image;
    if (image) {
        document.getElementById('upload-preview').classList.remove('hidden');
        document.getElementById('preview-img').src = image;
    }
}


// --- Logic Helpers ---

// Helper to resize and compress image to Base64
function compressAndEncodeImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG with 0.7 quality to keep size low
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('upload-preview');
            if (preview) preview.classList.remove('hidden');
            const img = document.getElementById('preview-img');
            if (img) img.src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault(); // Just in case, though we dispatch manually
    const type = document.getElementById('edit-type').value;
    const id = document.getElementById('edit-id').value;

    // Find the save button to disable it
    // We can assume it's the one in the modal actions
    const btn = document.querySelector('button[onclick*="dispatchEvent"]');
    const oldText = btn ? btn.innerText : 'Guardar';
    if (btn) { btn.disabled = true; btn.innerText = 'Guardando...'; }


    try {
        let imageUrl = null;
        const fileInput = document.getElementById('f-file');

        if (fileInput && fileInput.files.length > 0) {
            if (btn) btn.innerText = 'Procesando imagen...';
            // Compress and convert to Base64
            imageUrl = await compressAndEncodeImage(fileInput.files[0]);
        } else {
            const hiddenImg = document.getElementById('f-image');
            if (hiddenImg) imageUrl = hiddenImg.value;
        }

        let data = {};

        if (type === 'productos') {
            data = {
                name: document.getElementById('f-name').value,
                price: Number(document.getElementById('f-price').value),
                category: document.getElementById('f-category').value,
                stock: Number(document.getElementById('f-stock').value) || 0,
                status: document.getElementById('f-status').value,
                image: imageUrl || 'https://via.placeholder.com/150'
            };
        } else if (type === 'servicios') {
            data = {
                name: document.getElementById('f-name').value,
                price: Number(document.getElementById('f-price').value),
                category: document.getElementById('f-category').value,
            };
        } else if (type === 'promociones') {
            data = {
                title: document.getElementById('f-title').value,
                price: Number(document.getElementById('f-price').value),
                description: document.getElementById('f-description').value,
                image: imageUrl || 'https://via.placeholder.com/300x200'
            };
        } else if (type === 'citas') {
            // For citas we only edited status usually
            const name = document.getElementById('f-name').value;
            // ... gather preserved
            data = {
                status: document.getElementById('f-status').value,
                service: document.getElementById('f-service').value
            };
        } else if (type === 'pedidos') {
            data = {
                status: document.getElementById('f-status').value
            };
        }

        if (id) {
            await db.collection(type).doc(id).update(data);
        } else {
            if (type === 'citas') {
                // If creating new cita manually (unlikely but possible)
            } else {
                await db.collection(type).add(data);
            }
        }

        closeAdminModal();
        initAdmin();

    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = oldText; }
    }
}

// Global listener for the form
// Because the HTML has `document.getElementById('admin-form').dispatchEvent(new Event('submit'))`
// We need to make sure the form actually listens
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('admin-form');
    if (form) form.addEventListener('submit', handleFormSubmit);
});

// Helper delete
async function deleteItem(col, id) {
    if (!confirm("¿Eliminar?")) return;

    try {
        if (col === 'citas') {
            const docSnap = await db.collection('citas').doc(id).get();
            if (docSnap.exists) {
                const data = docSnap.data();
                if (data.date && data.time) {
                    // Update Horario using Query (Robust to ID format changes)
                    const scheduleQuery = await db.collection('horarios')
                        .where('date', '==', data.date)
                        .where('time', '==', data.time)
                        .limit(1)
                        .get();

                    if (!scheduleQuery.empty) {
                        const horarioRef = scheduleQuery.docs[0].ref;
                        // Use update, catch error if doc missing (just in case)
                        await horarioRef.update({ isBooked: false }).catch(e => console.warn("Sync update failed", e));
                    }
                }
            }
        }

        await db.collection(col).doc(id).delete();
        initAdmin();
    } catch (e) {
        console.error(e);
        alert("Error al eliminar: " + e.message);
    }
}

// --- Seeding ---
async function seedDatabase() {
    if (!confirm('¿Seguro que deseas inicializar la base de datos? Esto creará productos y servicios de prueba.')) return;

    const dummyProducts = [
        { name: "Crema Hidratante", category: "Cuidado Facial", price: 15000, stock: 10, status: "Disponible", image: "https://via.placeholder.com/150" },
        { name: "Serum Vitamina C", category: "Cuidado Facial", price: 22000, stock: 5, status: "Disponible", image: "https://via.placeholder.com/150" },
        { name: "Protector Solar SPF 50", category: "Protección Solar", price: 18000, stock: 2, status: "Agotado", image: "https://via.placeholder.com/150" }
    ];

    const dummyServices = [
        { name: "Limpieza Facial Profunda", category: "Tratamientos Faciales", price: 25000 },
        { name: "Masaje Relajante", category: "Masajes y Spa", price: 30000 },
        { name: "Depilación Láser Piernas", category: "Depilación y Exfoliación", price: 45000 }
    ];

    const dummyPromos = [
        { title: "Pack Relax", description: "Masaje + Facial al 20% off", price: 45000, image: "https://via.placeholder.com/300x200" }
    ];

    try {
        const batch = db.batch();

        dummyProducts.forEach(p => {
            const ref = db.collection('productos').doc();
            batch.set(ref, p);
        });

        dummyServices.forEach(s => {
            const ref = db.collection('servicios').doc();
            batch.set(ref, s);
        });

        dummyPromos.forEach(pr => {
            const ref = db.collection('promociones').doc();
            batch.set(ref, pr);
        });

        await batch.commit();
        alert('Base de datos inicializada con éxito. Recargando...');
        window.location.reload();
    } catch (e) {
        console.error("Error al sembrar:", e);
        alert("Error: " + e.message);
    }
}

// --- Horarios Management ---

async function loadDaySchedule() {
    const dateVal = document.getElementById('schedule-date').value;
    const tbody = document.getElementById('horarios-table');
    if (!dateVal || !tbody) return;

    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4">Cargando...</td></tr>';

    try {
        const slotsSnap = await db.collection('horarios').where('date', '==', dateVal).get();

        let slots = [];
        slotsSnap.forEach(doc => slots.push({ id: doc.id, ...doc.data() }));

        const citasSnap = await db.collection('citas').where('date', '==', dateVal).get();
        const bookedTimes = new Set();
        citasSnap.forEach(doc => {
            const d = doc.data();
            if (d.status !== 'Cancelada') bookedTimes.add(d.time);
        });

        slots.sort((a, b) => a.time.localeCompare(b.time));

        tbody.innerHTML = '';
        if (slots.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500">No hay horarios generados para este día.</td></tr>';
            return;
        }

        slots.forEach(slot => {
            const isBooked = bookedTimes.has(slot.time);
            const statusBadge = isBooked
                ? '<span class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">Ocupado</span>'
                : '<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Disponible</span>';

            tbody.innerHTML += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">${slot.time}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                         <button onclick="deleteHorario('${slot.id}')" class="text-red-600 hover:text-red-900"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-red-500">Error: ${e.message}</td></tr>`;
    }
}

async function addManualSlot() {
    const dateVal = document.getElementById('schedule-date').value;
    const timeVal = document.getElementById('manual-time').value;

    if (!dateVal || !timeVal) {
        alert("Selecciona fecha y hora.");
        return;
    }

    const [h, m] = timeVal.split(':');
    const d = new Date();
    d.setHours(h, m);
    const formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    try {
        await db.collection('horarios').add({
            date: dateVal,
            time: formattedTime
        });
        loadDaySchedule();
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function deleteHorario(id) {
    if (!confirm("¿Eliminar este horario? Los clientes ya no podrán reservarlo.")) return;
    await db.collection('horarios').doc(id).delete();
    loadDaySchedule();
}

async function generateMonthSchedule() {
    if (!confirm("Esto generará horarios para los próximos 30 días. ¿Continuar?")) return;

    const btn = document.querySelector('button[onclick="generateMonthSchedule()"]');
    if (btn) btn.innerText = "Generando...";

    const startDate = new Date();
    const batch = db.batch();
    let count = 0;

    for (let i = 0; i < 30; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);

        const day = d.getDay();
        const dateStr = d.toISOString().split('T')[0];

        let startH = 0, endH = 0;

        if (day >= 2 && day <= 5) { // Tue-Fri
            startH = 9; endH = 17;
        } else if (day === 6) { // Sat
            startH = 9; endH = 16;
        } else {
            continue;
        }

        let current = new Date(d);
        current.setHours(startH, 0, 0, 0);

        const endDay = new Date(d);
        endDay.setHours(endH, 0, 0, 0);

        while (true) {
            const nextEnd = new Date(current.getTime() + 90 * 60000); // 90 min
            if (nextEnd > endDay) break;

            const timeStr = current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

            const docId = `${dateStr}_${timeStr.replace(/[: ]/g, '')}`;
            const ref = db.collection('horarios').doc(docId);
            batch.set(ref, { date: dateStr, time: timeStr });
            count++;

            current = nextEnd;
        }
    }

    try {
        await batch.commit();
        alert(`Se generaron ${count} horarios.`);
        loadDaySchedule();
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    } finally {
        if (btn) btn.innerHTML = '<i class="fas fa-magic mr-2"></i>Generar Mes (Auto)';
    }
}

async function syncScheduleAvailability() {
    if (!confirm("Esto escaneará todas las citas activas y marcará los horarios correspondientes como OCUPADOS. ¿Continuar?")) return;

    const btn = document.querySelector('button[onclick="syncScheduleAvailability()"]');
    if (btn) btn.innerText = "Sincronizando...";

    try {
        const citasSnap = await db.collection('citas').get();
        let updates = 0;
        const batch = db.batch();

        // Arrays to process async queries
        const promises = [];

        citasSnap.forEach(doc => {
            const data = doc.data();
            if (data.status !== 'Cancelada' && data.date && data.time) {
                // Find matching horario
                const p = db.collection('horarios')
                    .where('date', '==', data.date)
                    .where('time', '==', data.time)
                    .limit(1)
                    .get()
                    .then(snap => {
                        if (!snap.empty) {
                            const hDoc = snap.docs[0];
                            if (!hDoc.data().isBooked) {
                                batch.update(hDoc.ref, { isBooked: true });
                                updates++;
                            }
                        }
                    });
                promises.push(p);
            }
        });

        await Promise.all(promises);

        if (updates > 0) {
            await batch.commit();
            alert(`Sincronización completa. Se corrigieron ${updates} horarios.`);
        } else {
            alert("Todo parece estar en orden. No se requirieron cambios.");
        }

        loadDaySchedule();

    } catch (e) {
        console.error(e);
        alert("Error al sincronizar: " + e.message);
    } finally {
        if (btn) btn.innerHTML = '<i class="fas fa-sync-alt me-2"></i>Sincronizar (Fix)';
    }
}

async function cleanupCancelledAppointments() {
    // New Rule: Run ONCE daily after 7:00 AM Costa Rica (Local time)
    console.log("Checking scheduled tasks...");

    const now = new Date();
    const todayStr = now.toDateString(); // "Wed Dec 17 2025"
    const lastRun = localStorage.getItem('last_cleanup_date');

    // 1. Check if already ran today
    if (lastRun === todayStr) {
        console.log("Daily cleanup already finished for today.");
        return;
    }

    // 2. Check if it's 7:00 AM or later
    if (now.getHours() < 7) {
        console.log("Too early for cleanup. Waiting for 7:00 AM.");
        return;
    }

    console.log("Running Daily Cleanup (7AM Batch)...");

    try {
        const snapshot = await db.collection('citas').where('status', '==', 'Cancelada').get();

        const batch = db.batch();
        let deletedCount = 0;

        snapshot.forEach(doc => {
            // Delete ALL cancelled appointments regardless of time
            // because this is a "Daily Flush" of the trash.
            batch.delete(doc.ref);
            deletedCount++;
        });

        if (deletedCount > 0) {
            await batch.commit();
            console.log(`Daily Cleanup: Purged ${deletedCount} cancelled appointments.`);
            if (typeof initAdmin === 'function') initAdmin();
        } else {
            console.log("Daily Cleanup: Nothing to clean.");
        }

        // Mark as done for today
        localStorage.setItem('last_cleanup_date', todayStr);

    } catch (e) {
        console.warn("Daily cleanup failed:", e);
    }
}

// Explicit Global Assignments to prevent ReferenceErrors
window.openProductModal = openProductModal;
window.openServiceModal = openServiceModal;
window.openPromoModal = openPromoModal;
window.editProduct = editProduct;
window.editService = editService;
window.editPromo = editPromo;
window.editCita = editCita;
window.loadDaySchedule = loadDaySchedule;
window.addManualSlot = addManualSlot;
window.deleteHorario = deleteHorario;
window.generateMonthSchedule = generateMonthSchedule;
window.syncScheduleAvailability = syncScheduleAvailability;
window.editPedido = editPedido;
window.deleteItem = deleteItem;
window.switchTab = switchTab;
window.logout = logout;
window.closeAdminModal = closeAdminModal;
window.previewImage = previewImage;
window.seedDatabase = seedDatabase;

// Run cleanup periodically or on load
setInterval(cleanupCancelledAppointments, 60000); // Check every minute
document.addEventListener('DOMContentLoaded', cleanupCancelledAppointments);
