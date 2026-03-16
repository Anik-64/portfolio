document.addEventListener('DOMContentLoaded', function() {
    const cardGrid = document.getElementById('cardGrid');
    const noData = document.getElementById('noData');
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
    const pdfFile = document.getElementById('pdf_file');
    const pdfUrlInput = document.getElementById('pdf_url');
    const uploadProgressContainer = document.getElementById('uploadProgressContainer');
    const uploadProgressBar = document.getElementById('uploadProgressBar');
    const uploadStatus = document.getElementById('uploadStatus');

    let originalData = [];
    let currentId = null;

    if (!localStorage.getItem('accessToken')) {
        window.location.href = '/login';
    }

    loadData();

    addBtn.addEventListener('click', () => {
        currentId = null;
        modalTitle.textContent = 'Add Certification';
        dataForm.reset();
        pdfFile.value = ''; // Reset file input
        uploadProgressContainer.classList.add('hidden');
        document.getElementById('is_visible').checked = true;
        document.getElementById('status').value = 'active';
        document.getElementById('display_order').value = 0;
        dataModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => dataModal.classList.add('hidden'));
    closeDeleteModal.addEventListener('click', () => deleteModal.classList.add('hidden'));
    cancelDelete.addEventListener('click', () => deleteModal.classList.add('hidden'));

    searchInput.addEventListener('input', debounce(() => {
        const query = searchInput.value.trim().toLowerCase();
        if (query) {
            const filtered = originalData.filter(item => 
                (item.title || '').toLowerCase().includes(query) || 
                (item.issuer || '').toLowerCase().includes(query)
            );
            renderData(filtered);
        } else {
            renderData(originalData);
        }
    }, 500));

    dataForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const saveBtn = dataForm.querySelector('button[type="submit"]');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

        try {
            // Check for file upload first
            if (pdfFile.files.length > 0) {
                const uploadedUrl = await uploadPdfFile(pdfFile.files[0]);
                if (!uploadedUrl) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save';
                    return;
                }
                pdfUrlInput.value = uploadedUrl;
            }

            const formData = {
                title: document.getElementById('titleStr').value.trim(),
                issuer: document.getElementById('issuer').value.trim(),
                issued_date: document.getElementById('issued_date').value || null,
                expiry_date: document.getElementById('expiry_date').value || null,
                credential_id: document.getElementById('credential_id').value.trim() || null,
                credential_url: document.getElementById('credential_url').value.trim() || null,
                pdf_url: pdfUrlInput.value.trim() || null,
                badge_image_url: document.getElementById('badge_image_url').value.trim() || null,
                status: document.getElementById('status').value.trim() || 'active',
                display_order: parseInt(document.getElementById('display_order').value) || 0,
                is_visible: document.getElementById('is_visible').checked
            };

            if (!formData.title || !formData.issuer) {
                showMessage('Title and Issuer are required', 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
                return;
            }

            if (currentId) {
                await updateData(currentId, formData);
            } else {
                await createData(formData);
            }
        } catch (err) {
            console.error(err);
            showMessage('Error during save', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    });

    async function uploadPdfFile(file) {
        uploadProgressContainer.classList.remove('hidden');
        uploadProgressBar.style.width = '0%';
        uploadStatus.textContent = 'Uploading...';

        const formData = new FormData();
        formData.append('bookFile', file);

        const accessToken = localStorage.getItem('accessToken');
        
        try {
            const xhr = new XMLHttpRequest();
            const promise = new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percent = (e.loaded / e.total) * 100;
                        uploadProgressBar.style.width = percent + '%';
                    }
                });

                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response.data.url);
                        } else {
                            reject(new Error('Upload failed'));
                        }
                    }
                };
            });

            xhr.open('POST', '/api/v1/upload/book/file', true);
            xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
            xhr.send(formData);

            const url = await promise;
            uploadStatus.textContent = 'Upload complete!';
            return url;
        } catch (err) {
            console.error('Upload error:', err);
            showMessage('PDF Upload failed', 'error');
            return null;
        } finally {
            setTimeout(() => {
                uploadProgressContainer.classList.add('hidden');
            }, 2000);
        }
    }

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
        const response = await fetchWithToken('/api/v1/settings/certifications');
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
        cardGrid.innerHTML = '';
        if (!items || items.length === 0) {
            noData.classList.remove('hidden');
            cardGrid.classList.add('hidden');
            return;
        }

        noData.classList.add('hidden');
        cardGrid.classList.remove('hidden');

        items.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100 overflow-hidden flex flex-col h-full';
            
            // Status Badge
            const statusClass = (item.status || '').toLowerCase() === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700';
            
            card.innerHTML = `
                <div class="p-5 flex-grow">
                    <div class="flex justify-between items-start mb-4">
                        <div class="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-100">
                            ${item.badge_image_url ? 
                                `<img src="${item.badge_image_url}" alt="${item.issuer}" class="w-full h-full object-contain p-1">` : 
                                `<i class="fas fa-certificate text-3xl text-blue-200"></i>`
                            }
                        </div>
                        <span class="px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md ${statusClass}">
                            ${item.status || 'Active'}
                        </span>
                    </div>
                    
                    <h3 class="text-lg font-bold text-gray-900 mb-1 leading-tight line-clamp-2" title="${item.title}">${item.title}</h3>
                    <p class="text-sm text-blue-600 font-medium mb-3">${item.issuer}</p>
                    
                    <div class="space-y-2 mt-4 pt-4 border-t border-gray-50">
                        <div class="flex items-center text-xs text-gray-500">
                            <i class="far fa-calendar-alt w-4 mr-2"></i>
                            <span>Issued: ${item.issued_date || 'N/A'}</span>
                        </div>
                        ${item.expiry_date ? `
                        <div class="flex items-center text-xs text-gray-500">
                            <i class="fas fa-hourglass-end w-4 mr-2"></i>
                            <span>Expires: ${item.expiry_date}</span>
                        </div>` : ''}
                        ${item.credential_id ? `
                        <div class="flex items-center text-xs text-gray-500">
                            <i class="fas fa-id-card w-4 mr-2"></i>
                            <span>ID: ${item.credential_id}</span>
                        </div>` : ''}
                    </div>
                </div>
                
                <div class="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center mt-auto">
                    <div class="flex gap-2">
                        ${item.credential_url ? 
                            `<a href="${item.credential_url}" target="_blank" class="text-blue-500 hover:text-blue-700 transition-colors bg-white p-2 rounded-lg border border-gray-200 shadow-sm" title="Verify Online">
                                <i class="fas fa-external-link-alt text-sm"></i>
                            </a>` : ''
                        }
                        ${item.pdf_url ? 
                            `<a href="${item.pdf_url}" target="_blank" class="text-red-500 hover:text-red-700 transition-colors bg-white p-2 rounded-lg border border-gray-200 shadow-sm" title="View PDF">
                                <i class="far fa-file-pdf text-sm"></i>
                            </a>` : ''
                        }
                    </div>
                    
                    <div class="flex gap-2">
                        <button onclick="editDataItem(${item.id})" class="text-gray-600 hover:text-yellow-600 transition-colors p-2" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="confirmDeleteData(${item.id})" class="text-gray-600 hover:text-red-600 transition-colors p-2" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
            cardGrid.appendChild(card);
        });
    }

    // Adjusting global scope for onclick handlers in dynamically generated HTML
    window.editDataItem = editDataItem;
    window.confirmDeleteData = confirmDeleteData;

    async function createData(postData) {
        const response = await fetchWithToken('/api/v1/settings/certifications', {
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
        const response = await fetchWithToken(`/api/v1/settings/certifications/${id}`);
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        const itemData = data.data;
        currentId = id;
        modalTitle.textContent = 'Edit Certification';
        
        document.getElementById('titleStr').value = itemData.title || '';
        document.getElementById('issuer').value = itemData.issuer || '';
        document.getElementById('issued_date').value = itemData.issued_date || '';
        document.getElementById('expiry_date').value = itemData.expiry_date || '';
        document.getElementById('credential_id').value = itemData.credential_id || '';
        document.getElementById('credential_url').value = itemData.credential_url || '';
        document.getElementById('pdf_url').value = itemData.pdf_url || '';
        document.getElementById('badge_image_url').value = itemData.badge_image_url || '';
        document.getElementById('status').value = itemData.status || '';
        document.getElementById('display_order').value = itemData.display_order || 0;
        document.getElementById('is_visible').checked = itemData.is_visible;

        pdfFile.value = ''; // Reset file input
        uploadProgressContainer.classList.add('hidden');
        dataModal.classList.remove('hidden');
    }

    async function updateData(id, putData) {
        const response = await fetchWithToken(`/api/v1/settings/certifications/${id}`, {
            method: 'PUT',
            body: JSON.stringify(putData)
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message || data.error, 'error');
            return;
        }
        showMessage('Successfully updated', 'success');
        dataModal.classList.add('hidden');
        loadData();
    }

    function confirmDeleteData(id) {
        currentId = id;
        deleteModal.classList.remove('hidden');
    }

    async function deleteData(id) {
        const response = await fetchWithToken(`/api/v1/settings/certifications/${id}`, {
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
