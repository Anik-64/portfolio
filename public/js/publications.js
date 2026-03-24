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
    const floatingMessage = document.getElementById('floatingMessage');
    const searchInput = document.getElementById('searchInput');
    const pdfFile = document.getElementById('pdfFile');
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
        modalTitle.textContent = 'Add Publication';
        dataForm.reset();
        document.getElementById('is_visible').checked = true;
        
        // Reset PDF upload states
        if (pdfFile) pdfFile.value = '';
        if (uploadProgressContainer) uploadProgressContainer.classList.add('hidden');
        
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
                (item.publisher || '').toLowerCase().includes(query)
            );
            renderData(filtered);
        } else {
            renderData(originalData);
        }
    }, 500));

    dataForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const saveBtn = dataForm.querySelector('button[type="submit"]');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
        }

        try {
            // Check for file upload first
            if (pdfFile && pdfFile.files.length > 0) {
                const uploadedUrl = await uploadPdfFile(pdfFile.files[0]);
                if (!uploadedUrl) {
                    if (saveBtn) {
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Save';
                    }
                    return;
                }
                if (pdfUrlInput) pdfUrlInput.value = uploadedUrl;
            }

            const authorsValue = document.getElementById('authors').value.trim();
            const authorsArray = authorsValue ? authorsValue.split(',').map(s => s.trim()).filter(s => s) : [];

            const linkedinValue = document.getElementById('author_linkedin_urls').value.trim();
            const linkedinArray = linkedinValue ? linkedinValue.split(',').map(s => s.trim()).filter(s => s) : [];

            const formData = {
                title: document.getElementById('titleStr').value.trim(),
                journal_name: document.getElementById('journal_name').value.trim() || null,
                publisher: document.getElementById('publisher').value.trim() || null,
                authors: authorsArray,
                author_linkedin_urls: linkedinArray,
                abstract: document.getElementById('abstract').value.trim() || null,
                published_date: document.getElementById('publication_date').value || null,
                doi: document.getElementById('doi').value.trim() || null,
                publication_url: document.getElementById('publication_url').value.trim() || null,
                pdf_url: (pdfUrlInput ? pdfUrlInput.value.trim() : document.getElementById('pdf_url').value.trim()) || null,
                thumbnail_url: document.getElementById('thumbnail_url').value.trim() || null,
                is_visible: document.getElementById('is_visible').checked
            };

            if (!formData.title) {
                showMessage('Title is required', 'error');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save';
                }
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
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
            }
        }
    });

    async function uploadPdfFile(file) {
        if (uploadProgressContainer) uploadProgressContainer.classList.remove('hidden');
        if (uploadProgressBar) uploadProgressBar.style.width = '0%';
        if (uploadStatus) uploadStatus.textContent = 'Uploading...';

        const formData = new FormData();
        formData.append('bookFile', file);

        const accessToken = localStorage.getItem('accessToken');
        
        try {
            const xhr = new XMLHttpRequest();
            const promise = new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && uploadProgressBar) {
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
            if (uploadStatus) uploadStatus.textContent = 'Upload complete!';
            return url;
        } catch (err) {
            console.error('Upload error:', err);
            showMessage('PDF Upload failed', 'error');
            return null;
        } finally {
            setTimeout(() => {
                if (uploadProgressContainer) uploadProgressContainer.classList.add('hidden');
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
        const response = await fetchWithToken('/api/v1/settings/publications');
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
        const container = document.querySelector('.table-container');
        
        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="text-center py-10 text-gray-500">
                    <i class="fas fa-book-open text-4xl mb-3 block opacity-20"></i>
                    No publications found
                </div>
            `;
            return;
        }

        // Dynamic Formation: Card view for 1 or 2 items, Table for 3+
        if (items.length <= 2) {
            renderCardView(items, container);
        } else {
            renderTableView(items, container);
        }
    }

    function renderAuthors(item) {
        if (!item.authors || item.authors.length === 0) return '-';
        
        return item.authors.map((author, index) => {
            const url = (item.author_linkedin_urls && item.author_linkedin_urls[index]) ? item.author_linkedin_urls[index] : null;
            if (url) {
                return `<a href="${url}" target="_blank" class="text-blue-600 hover:underline"><i class="fab fa-linkedin text-[10px] mr-1"></i>${author}</a>`;
            }
            return author;
        }).join(', ');
    }

    function renderCardView(items, container) {
        let cardsHtml = '<div class="grid grid-cols-1 gap-6 p-2">';
        
        items.forEach(item => {
            const dateStr = item.published_date 
                ? new Date(item.published_date).toLocaleDateString('en-BD', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'Asia/Dhaka'
                    })
                : 'N/A';
            const thumbUrl = item.thumbnail_url || 'https://via.placeholder.com/150x200?text=No+Cover';
            const authorsHtml = renderAuthors(item);
            
            cardsHtml += `
                <div class="bg-gray-50 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col md:flex-row h-full">
                    <div class="w-full md:w-1/3 bg-gray-200 flex items-center justify-center p-2">
                        <img src="${thumbUrl}" alt="Thumbnail" class="max-h-48 object-contain shadow-sm rounded">
                    </div>
                    <div class="p-4 flex-1 flex flex-col">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                ${item.journal_name || item.publisher || 'Publication'}
                            </span>
                            <div class="flex gap-2">
                                <button onclick="editDataItem(${item.id})" class="text-yellow-500 hover:text-yellow-600"><i class="fas fa-edit"></i></button>
                                <button onclick="confirmDeleteData(${item.id})" class="text-red-500 hover:text-red-600"><i class="fas fa-trash-alt"></i></button>
                            </div>
                        </div>
                        <h3 class="font-bold text-lg leading-tight mb-2 text-gray-900">${item.title}</h3>
                        <p class="text-xs text-gray-500 mb-2 italic">By ${authorsHtml}</p>
                        <p class="text-sm text-gray-600 flex-1 line-clamp-3 mb-4">${item.abstract || 'No abstract available.'}</p>
                        <div class="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
                            <span class="text-xs text-gray-400"><i class="far fa-calendar-alt mr-1"></i> ${dateStr}</span>
                            <div class="flex gap-2">
                                ${item.publication_url ? `<a href="${item.publication_url}" target="_blank" class="text-blue-500 hover:text-blue-600 text-xs font-medium">Link <i class="fas fa-external-link-alt text-[10px]"></i></a>` : ''}
                                ${item.pdf_url ? `<a href="${item.pdf_url}" target="_blank" class="text-red-500 hover:text-red-600 text-xs font-medium">PDF <i class="fas fa-file-pdf text-[10px]"></i></a>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        cardsHtml += '</div>';
        container.innerHTML = cardsHtml;
    }

    function renderTableView(items, container) {
        container.innerHTML = `
            <div class="table-responsive">
                <table id="dataTable" class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">ID</th>
                            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Thumbnail</th>
                            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Title</th>
                            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Authors</th>
                            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Journal/Publisher</th>
                            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Visible</th>
                            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${items.map((item, index) => {
                            // Fix: Use UTC to avoid timezone shifts for DATE columns
                            const dateStr = item.published_date ? new Date(item.published_date).toLocaleDateString(undefined, {timeZone: 'UTC'}) : 'N/A';
                            const thumbUrl = item.thumbnail_url || 'https://via.placeholder.com/40x50?text=No+Cover';
                            const journalPublisher = item.journal_name || item.publisher || '-';
                            const authorsHtml = renderAuthors(item);
                            
                            return `
                                <tr>
                                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${index + 1}</td>
                                    <td class="px-4 py-3 whitespace-nowrap">
                                        <img src="${thumbUrl}" alt="Thumbnail" class="h-10 w-8 object-cover rounded shadow-sm">
                                    </td>
                                    <td class="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate" title="${item.title}">${item.title}</td>
                                    <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title="${item.authors ? item.authors.join(', ') : '-'}">${authorsHtml}</td>
                                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${journalPublisher}</td>
                                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${dateStr}</td>
                                    <td class="px-4 py-3 whitespace-nowrap">
                                        ${item.is_visible 
                                            ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Yes</span>' 
                                            : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">No</span>'}
                                    </td>
                                    <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                        <div class="flex justify-end gap-2">
                                            <button onclick="editDataItem(${item.id})" class="bg-yellow-500 hover:bg-yellow-600 text-white rounded px-2 py-1"><i class="fas fa-edit"></i></button>
                                            <button onclick="confirmDeleteData(${item.id})" class="bg-red-500 hover:bg-red-600 text-white rounded px-2 py-1"><i class="fas fa-trash-alt"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Make functions globally available for inline onclick handlers
    window.editDataItem = editDataItem;
    window.confirmDeleteData = confirmDeleteData;

    async function createData(postData) {
        const response = await fetchWithToken('/api/v1/settings/publications', {
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
        const response = await fetchWithToken(`/api/v1/settings/publications/${id}`);
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        const itemData = data.data;
        currentId = id;
        modalTitle.textContent = 'Edit Publication';
        
        // Reset PDF upload states
        if (pdfFile) pdfFile.value = '';
        if (uploadProgressContainer) uploadProgressContainer.classList.add('hidden');
        
        document.getElementById('titleStr').value = itemData.title || '';
        document.getElementById('journal_name').value = itemData.journal_name || '';
        document.getElementById('publisher').value = itemData.publisher || '';
        document.getElementById('authors').value = (itemData.authors && Array.isArray(itemData.authors)) ? itemData.authors.join(', ') : '';
        document.getElementById('author_linkedin_urls').value = (itemData.author_linkedin_urls && Array.isArray(itemData.author_linkedin_urls)) ? itemData.author_linkedin_urls.join(', ') : '';
        document.getElementById('abstract').value = itemData.abstract || '';
        document.getElementById('publication_date').value = itemData.published_date ? new Date(itemData.published_date).toISOString().split('T')[0] : '';
        document.getElementById('doi').value = itemData.doi || '';
        document.getElementById('publication_url').value = itemData.publication_url || '';
        document.getElementById('pdf_url').value = itemData.pdf_url || '';
        document.getElementById('thumbnail_url').value = itemData.thumbnail_url || '';
        document.getElementById('is_visible').checked = itemData.is_visible;

        dataModal.classList.remove('hidden');
    }

    async function updateData(id, putData) {
        const response = await fetchWithToken(`/api/v1/settings/publications/${id}`, {
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
        const response = await fetchWithToken(`/api/v1/settings/publications/${id}`, {
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
