document.addEventListener('DOMContentLoaded', function() {
    const dataTable = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
    const addBtn = document.getElementById('addBtn');
    const dataModal = document.getElementById('dataModal');
    const deleteModal = document.getElementById('deleteModal');
    const closeModal = document.getElementById('closeModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    const dataForm = document.getElementById('dataForm');
    const modalTitle = document.getElementById('modalTitle');
    const floatingMessage = document.getElementById('floatingMessage');
    const searchInput = document.getElementById('searchInput');

    let originalData = [];
    let currentId = null;

    if (!localStorage.getItem('accessToken')) {
        window.location.href = '/login';
    }

    loadData();

    addBtn.addEventListener('click', () => {
        currentId = null;
        modalTitle.textContent = 'Add Contact Message';
        dataForm.reset();
        
        // Remove readonly for creation
        document.getElementById('name').readOnly = false;
        document.getElementById('email').readOnly = false;
        document.getElementById('subject').readOnly = false;
        document.getElementById('message').readOnly = false;

        document.getElementById('name').classList.remove('bg-gray-50');
        document.getElementById('email').classList.remove('bg-gray-50');
        document.getElementById('subject').classList.remove('bg-gray-50');
        document.getElementById('message').classList.remove('bg-gray-50');

        document.getElementById('status').value = 'new';
        document.getElementById('addFieldsGroup').classList.remove('hidden');

        dataModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => dataModal.classList.add('hidden'));
    closeDeleteModal.addEventListener('click', () => deleteModal.classList.add('hidden'));
    cancelDelete.addEventListener('click', () => deleteModal.classList.add('hidden'));

    searchInput.addEventListener('input', debounce(() => {
        const query = searchInput.value.trim().toLowerCase();
        if (query) {
            const filtered = originalData.filter(item => 
                (item.name || '').toLowerCase().includes(query) || 
                (item.email || '').toLowerCase().includes(query) || 
                (item.subject || '').toLowerCase().includes(query)
            );
            renderData(filtered);
        } else {
            renderData(originalData);
        }
    }, 500));

    dataForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            subject: document.getElementById('subject').value.trim() || null,
            message: document.getElementById('message').value.trim(),
            status: document.getElementById('status').value.trim() || 'new',
        };

        if (!formData.name || !formData.email || !formData.message) {
            showMessage('Name, Email, and Message are required', 'error');
            return;
        }

        if (currentId) {
            updateData(currentId, formData);
        } else {
            createData(formData);
        }
    });

    confirmDelete.addEventListener('click', function() {
        if (currentId) deleteData(currentId);
    });

    async function fetchWithToken(url, options = {}) {
        const accessToken = localStorage.getItem('accessToken');
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        };

        try {
            const response = await fetch(url, options);
            if (response.status === 401) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    options.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
                    return await fetch(url, options);
                } else {
                    window.location.href = '/login';
                    return null;
                }
            }
            return response;
        } catch (err) {
            console.error('Fetch error:', err);
            showMessage('An error occurred. Please try again.', 'error');
            return null;
        }
    }

    async function refreshAccessToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return false;

        try {
            const response = await fetch('/api/v1/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            const data = await response.json();
            if (data.error) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                return false;
            }
            localStorage.setItem('accessToken', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);
            return true;
        } catch (err) {
            console.error('Refresh token error:', err);
            return false;
        }
    }

    async function loadData() {
        const response = await fetchWithToken('/api/v1/settings/contact-messages');
        if (!response) return;

        if(response.status === 404) {
             renderData([]);
             return;
        }

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            renderData([]);
            return;
        }
        originalData = data.data;
        renderData(data.data);
    }

    function renderData(items) {
        dataTable.innerHTML = '';
        if (!items || items.length === 0) {
            const row = dataTable.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 6;
            cell.textContent = 'No messages found';
            cell.className = 'text-center py-4 text-black';
            return;
        }

        items.forEach((item, index) => {
            const row = dataTable.insertRow();

            const idCell = row.insertCell(0);
            idCell.textContent = index + 1;
            idCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-black';
            
            const senderCell = row.insertCell(1);
            senderCell.innerHTML = `<strong>${item.name}</strong><br><span class="text-xs text-blue-500">${item.email}</span>`;
            senderCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-800';
            
            const subjCell = row.insertCell(2);
            subjCell.textContent = item.subject || '-';
            subjCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';

            const dateCell = row.insertCell(3);
            dateCell.textContent = new Date(item.created_at).toLocaleString();
            dateCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';

            const statusCell = row.insertCell(4);
            let statusBadge = '';
            if (item.status === 'new') statusBadge = '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">New</span>';
            else if (item.status === 'read') statusBadge = '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Read</span>';
            else if (item.status === 'replied') statusBadge = '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Replied</span>';
            else statusBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">${item.status}</span>`;

            statusCell.innerHTML = statusBadge;
            statusCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';

            const actionsCell = row.insertCell(5);
            actionsCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-black text-right';

            const actionButtons = document.createElement('div');
            actionButtons.className = 'flex justify-end gap-2';
            
            const readBtn = document.createElement('button');
            readBtn.innerHTML = '<i class="fas fa-eye"></i> View';
            readBtn.className = 'bg-blue-500 hover:bg-blue-600 text-white rounded px-3 py-1 text-xs';
            readBtn.addEventListener('click', () => editDataItem(item.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteBtn.className = 'bg-red-500 hover:bg-red-600 text-white rounded px-3 py-1 text-xs';
            deleteBtn.addEventListener('click', () => confirmDeleteData(item.id));

            actionButtons.appendChild(readBtn);
            actionButtons.appendChild(deleteBtn);
            actionsCell.appendChild(actionButtons);
        });
    }

    async function createData(postData) {
        const response = await fetchWithToken('/api/v1/settings/contact-messages', {
            method: 'POST',
            body: JSON.stringify(postData)
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message || data.error, 'error');
            return;
        }
        showMessage('Successfully added', 'success');
        dataModal.classList.add('hidden');
        loadData();
    }

    async function editDataItem(id) {
        const response = await fetchWithToken(`/api/v1/settings/contact-messages/${id}`);
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        const itemData = data.data;
        currentId = id;
        modalTitle.textContent = 'View/Update Message Status';
        document.getElementById('addFieldsGroup').classList.add('hidden');

        // Make fields readonly 
        document.getElementById('name').readOnly = true;
        document.getElementById('email').readOnly = true;
        document.getElementById('subject').readOnly = true;
        document.getElementById('message').readOnly = true;

        document.getElementById('name').classList.add('bg-gray-50');
        document.getElementById('email').classList.add('bg-gray-50');
        document.getElementById('subject').classList.add('bg-gray-50');
        document.getElementById('message').classList.add('bg-gray-50');

        document.getElementById('name').value = itemData.name || '';
        document.getElementById('email').value = itemData.email || '';
        document.getElementById('subject').value = itemData.subject || '';
        document.getElementById('message').value = itemData.message || '';
        document.getElementById('status').value = itemData.status || 'new';

        dataModal.classList.remove('hidden');

        // Automatically mark as read if it was new
        if (itemData.status === 'new') {
            document.getElementById('status').value = 'read';
            updateData(id, { ...itemData, status: 'read' }, true);
        }
    }

    async function updateData(id, putData, silent = false) {
        const response = await fetchWithToken(`/api/v1/settings/contact-messages/${id}`, {
            method: 'PUT',
            body: JSON.stringify(putData)
        });
        if (!response) return;

        const data = await response.json();
        if (data.error && !silent) {
            showMessage(data.message || data.error, 'error');
            return;
        }

        if (!silent) {
            showMessage('Successfully updated', 'success');
            dataModal.classList.add('hidden');
        }
        loadData();
    }

    function confirmDeleteData(id) {
        currentId = id;
        deleteModal.classList.remove('hidden');
    }

    async function deleteData(id) {
        const response = await fetchWithToken(`/api/v1/settings/contact-messages/${id}`, {
            method: 'DELETE'
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        showMessage('Successfully deleted', 'success');
        deleteModal.classList.add('hidden');
        loadData();
    }

    function showMessage(message, type) {
        floatingMessage.textContent = message;
        floatingMessage.className = `floating-message ${type} show`;
        setTimeout(() => {
            floatingMessage.classList.remove('show');
            setTimeout(() => {
                floatingMessage.textContent = '';
                floatingMessage.className = 'floating-message';
            }, 300);
        }, 3000);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});
