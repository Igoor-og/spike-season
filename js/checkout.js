/**
 * Spike Season Checkout Logic - Robust Version
 */

const PRODUCT_PRICE = 109.90;
const SHIPPING_VALUES = {
    'SP': 15, 'RJ': 15, 'MG': 15, 'ES': 15,
    'PR': 18, 'SC': 18, 'RS': 18,
    'DF': 20, 'GO': 20, 'MT': 20, 'MS': 20,
    'BA': 22, 'PE': 22, 'CE': 22, 'SE': 22, 'AL': 22, 'PB': 22, 'RN': 22, 'MA': 22, 'PI': 22,
    'AM': 25, 'PA': 25, 'RO': 25, 'AC': 25, 'RR': 25, 'AP': 25, 'TO': 25
};
const COUPONS = {
    'SKI15': 0.15,
    'SKI10': 0.10,
    'FUG10': 0.10,
    'SWAGBOY10': 0.10,
    'DEV5': 0.954545,
};

// Security Note: Token is used directly for stability in file:// environment.
const MP_ACCESS_TOKEN = CONFIG.MERCADOPAGO_ACCESS_TOKEN;

function formatBRL(v) {
    try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)); } catch { return `R$ ${Number(v||0).toFixed(2).replace('.', ',')}`; }
}

function calculateFinalPrice(basePrice, quantity, shippingCost, couponDiscountPercent, couponDiscountValue) {
    const subtotal = (Number(basePrice) * Number(quantity));
    const percent = subtotal * Number(couponDiscountPercent || 0);
    const value = Number(couponDiscountValue || 0);
    const total = subtotal + Number(shippingCost || 0) - (percent + value);
    return Number(total.toFixed(2));
}

// Defensive state initialization
let initialCart = [];
let initialUserData = {};
try {
    const savedCart = localStorage.getItem('spikeCart');
    if (savedCart) initialCart = JSON.parse(savedCart);
    if (!Array.isArray(initialCart)) initialCart = [];

    const savedUser = localStorage.getItem('spikeUserData');
    if (savedUser) initialUserData = JSON.parse(savedUser);
} catch (e) {
    console.error("Spike: Error loading state, resetting...", e);
    localStorage.removeItem('spikeCart');
    localStorage.removeItem('spikeUserData');
}

const state = {
    currentStep: 1,
    cart: initialCart,
    userData: initialUserData,
    selectedColor: 'Preto',
    quantity: 1,
    appliedCoupon: null,
    freight: 0,
    paymentGenerated: false,
    orderSubmitting: false
};

// --- Initialization ---
const initCheckout = () => {
    console.log("Spike: Initializing Checkout...");
    initUI();
    updateCartUI();
    restoreStep();
    setupMasks();
    console.log("Spike: Current State:", state);
};

// Robust Initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCheckout);
} else {
    initCheckout();
}

function initUI() {
    // 1. Color dots
    const dots = document.querySelectorAll('.color-dot');
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            dots.forEach(d => d.classList.remove('selected'));
            dot.classList.add('selected');
            state.selectedColor = dot.dataset.color || 'Preto';
            const colorText = document.getElementById('selected-color-text');
            if (colorText) colorText.innerText = `Cor selecionada: ${state.selectedColor}`;
        });
    });

    // 2. Qty control
    const safeBind = (id, event, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
        else console.warn(`Spike: Element #${id} not found for ${event} binding.`);
    };

    safeBind('qty-plus', 'click', () => {
        state.quantity++;
        const val = document.getElementById('qty-val');
        if (val) val.innerText = state.quantity;
    });

    safeBind('qty-minus', 'click', () => {
        if (state.quantity > 1) {
            state.quantity--;
            const val = document.getElementById('qty-val');
            if (val) val.innerText = state.quantity;
        }
    });

    // 3. Add to Cart
    safeBind('add-to-cart', 'click', () => {
        console.log("Spike: Clicked 'Add to Cart'");
        addToCart();
    });

    // 4. Navigation
    safeBind('next-to-step-2', 'click', () => setStep(2));
    safeBind('back-to-step-1', 'click', () => setStep(1));
    safeBind('back-to-step-2', 'click', () => setStep(2));
    safeBind('confirm-data', 'click', validateAndConfirmData);

    // 5. CEP autocomplete
    safeBind('cep', 'blur', handleCEP);

    // 6. Coupon
    safeBind('apply-coupon', 'click', applyCoupon);

    // 7. Payment
    safeBind('gen-payment', 'click', generatePayment);
    safeBind('paid-btn', 'click', handlePaidConfirmation);

    // Hamburger Menu
    const hamburger = document.getElementById('hamburger');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuClose = document.getElementById('menu-close');

    const openMenu = () => {
        menuOverlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeMenu = () => {
        menuOverlay?.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    if (hamburger) hamburger.addEventListener('click', openMenu);
    if (menuClose) menuClose.addEventListener('click', closeMenu);

    // Close when clicking links
    document.querySelectorAll('.menu-item').forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    // Modal close
    safeBind('modal-ok', 'click', () => closeModal('generic-modal'));
    safeBind('modal-cancel', 'click', () => closeModal('generic-modal'));
}

// --- Cart Logic ---
function addToCart() {
    try {
        const item = {
            id: Date.now(),
            color: state.selectedColor || 'Preto',
            quantity: state.quantity || 1,
            price: PRODUCT_PRICE
        };

        console.log("Spike: Pushing item to cart:", item);
        state.cart.push(item);

        saveCart();
        updateCartUI();

        // Reset local qty
        state.quantity = 1;
        const qVal = document.getElementById('qty-val');
        if (qVal) qVal.innerText = 1;

        // Visual feedback
        const nextBtn = document.getElementById('next-to-step-2');
        if (nextBtn) {
            nextBtn.classList.add('glow-purple');
            setTimeout(() => nextBtn.classList.remove('glow-purple'), 1000);
        }
    } catch (err) {
        console.error("Spike: Failed to add to cart:", err);
    }
}

function updateCartUI() {
    const listEl = document.getElementById('cart-list');
    const totalEl = document.getElementById('cart-total-display');
    const nextBtn = document.getElementById('next-to-step-2');

    if (!listEl) return;
    listEl.innerHTML = '';

    let total = 0;
    state.cart.forEach((item, index) => {
        // Handle potential corruption
        const price = item.price || PRODUCT_PRICE;
        const qty = item.quantity || 1;
        const subtotal = qty * price;
        total += subtotal;

        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
            <div style="flex: 1;">
                <span style="font-weight: 600;">${item.color}</span> x${qty}
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="color: var(--primary-purple); font-weight: bold;">${formatBRL(subtotal)}</span>
                <button class="remove-item-btn" data-index="${index}" style="background: none; border: none; color: #ff4444; font-weight: bold; font-size: 1.2rem; cursor: pointer;">&times;</button>
            </div>
        `;
        listEl.appendChild(row);
    });

    // Re-bind remove buttons (avoiding scope issues with inline onclick)
    document.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            removeFromCart(idx);
        });
    });

    if (totalEl) totalEl.innerText = `${formatBRL(total)}`;
    if (nextBtn) nextBtn.disabled = state.cart.length === 0;

    // Reset payment state if cart is modified
    if (state.paymentGenerated) {
        state.paymentGenerated = false;
        const pBtn = document.getElementById('paid-btn');
        const gBtn = document.getElementById('gen-payment');
        if (pBtn) pBtn.classList.add('hidden');
        if (gBtn) gBtn.classList.remove('hidden');
    }
}

function removeFromCart(index) {
    console.log("Spike: Removing index", index);
    state.cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function saveCart() {
    try {
        localStorage.setItem('spikeCart', JSON.stringify(state.cart));
    } catch (e) {
        console.error("Spike: Error saving cart", e);
    }
}

// --- Form Logic ---
function setupMasks() {
    const cpfInput = document.getElementById('cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 11) v = v.slice(0, 11);
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
            e.target.value = v;
        });
    }

    const telInput = document.getElementById('telefone');
    if (telInput) {
        telInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 11) v = v.slice(0, 11);
            v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
            v = v.replace(/(\d)(\d{4})$/, "$1-$2");
            e.target.value = v;
        });
    }

    const cepInput = document.getElementById('cep');
    if (cepInput) {
        cepInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 8) v = v.slice(0, 8);
            v = v.replace(/(\d{5})(\d)/, "$1-$2");
            e.target.value = v;

            // Trigger CEP check automatically on 8 digits
            if (v.replace(/\D/g, "").length === 8) {
                handleCEP();
            }
        });
    }
}

async function handleCEP() {
    const cepVal = document.getElementById('cep')?.value || "";
    const cep = cepVal.replace(/\D/g, "");
    if (cep.length !== 8) return;

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (data.erro) {
            showModal('Erro', 'CEP não encontrado.');
            return;
        }

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('rua', data.logradouro);
        setVal('bairro', data.bairro);
        setVal('cidade', data.localidade);
        setVal('estado', data.uf);

        state.freight = SHIPPING_VALUES[data.uf] || 25;
        saveUserData();
    } catch (e) {
        console.error("Spike: CEP error", e);
    }
}

function applyCoupon() {
    const code = document.getElementById('cupom')?.value.toUpperCase() || "";
    if (Object.prototype.hasOwnProperty.call(COUPONS, code)) {
        state.appliedCoupon = { code: code, value: COUPONS[code] };
        showModal('Sucesso', 'Cupom aplicado com sucesso!');
    } else {
        state.appliedCoupon = null;
        showModal('Erro', 'Cupom inválido ou expirado.');
    }
}

function validateAndConfirmData() {
    const required = ['nome', 'cpf', 'email', 'telefone', 'cep', 'rua', 'numero', 'bairro'];
    for (let id of required) {
        const input = document.getElementById(id);
        if (!input || !input.value.trim()) {
            showModal('Erro', 'Por favor, preencha todos os campos obrigatórios.');
            if (input) input.focus();
            return;
        }
    }

    const email = document.getElementById('email').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showModal('Erro', 'E-mail inválido.');
        return;
    }

    const cpf = document.getElementById('cpf').value.replace(/\D/g, "");
    if (cpf.length !== 11) {
        showModal('Erro', 'CPF inválido.');
        return;
    }

    saveUserData();
    showConfirmModal('Confirme seus Dados', 'Tudo certo com suas informações? Clique em Confirmar para ir ao pagamento.', () => {
        setStep(3);
    });
}

function saveUserData() {
    const fields = ['nome', 'cpf', 'email', 'telefone', 'cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado'];
    fields.forEach(f => {
        const el = document.getElementById(f);
        if (el) state.userData[f] = el.value;
    });
    localStorage.setItem('spikeUserData', JSON.stringify(state.userData));
}

// --- Payment Logic ---
function updateSummary() {
    const summaryList = document.getElementById('order-summary');
    if (!summaryList) return;
    summaryList.innerHTML = '';

    let subtotal = 0;
    state.cart.forEach(item => {
        const qty = item.quantity || 1;
        const price = item.price || PRODUCT_PRICE;
        const itemSubtotal = qty * price;
        subtotal += itemSubtotal;

        const div = document.createElement('div');
        div.style = 'display: flex; justify-content: space-between; margin-bottom: 15px; color: var(--gray-text);';
        div.innerHTML = `<span>${item.color} x${qty}</span> <span>${formatBRL(itemSubtotal)}</span>`;
        summaryList.appendChild(div);
    });

    const discount = state.appliedCoupon ? (subtotal + state.freight) * state.appliedCoupon.value : 0;

    let freightVal = state.freight;
    if (state.appliedCoupon && (state.appliedCoupon.code === 'DEV5' || state.appliedCoupon.code === 'FLEXZERO')) {
        freightVal = 0;
    }

    const total = subtotal + freightVal - discount;

    const setDisplay = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setDisplay('summary-subtotal', `${formatBRL(subtotal)}`);
    setDisplay('summary-freight', `${formatBRL(freightVal)}`);

    const cRow = document.getElementById('coupon-row');
    if (cRow) {
        if (discount > 0) {
            cRow.style.display = 'flex';
            setDisplay('summary-discount', `- ${formatBRL(discount)}`);
        } else {
            cRow.style.display = 'none';
        }
    }

    setDisplay('summary-total', `${formatBRL(total)}`);
}

function buildEMV(id, value) {
    const len = String(value.length).padStart(2, '0');
    return `${id}${len}${value}`;
}

function crc16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
            else crc = (crc << 1);
            crc &= 0xFFFF;
        }
    }
    return (crc >>> 0).toString(16).toUpperCase().padStart(4, '0');
}

function generatePixPayload(key, name, city, amount, reference) {
    const gui = buildEMV('00', 'BR.GOV.BCB.PIX');
    const keyField = buildEMV('01', key);
    const accInfo = buildEMV('26', gui + keyField);
    const payloadFormat = buildEMV('00', '01');
    const merchantCat = buildEMV('52', '0000');
    const currency = buildEMV('53', '986');
    const amountField = amount > 0 ? buildEMV('54', String(amount.toFixed(2))) : '';
    const country = buildEMV('58', 'BR');
    const nameField = buildEMV('59', String(name).slice(0, 25));
    const cityField = buildEMV('60', String(city).slice(0, 15));
    const ref = buildEMV('05', reference || 'ORDER');
    const addData = buildEMV('62', ref);
    const noCrc = payloadFormat + accInfo + merchantCat + currency + amountField + country + nameField + cityField + addData + '6304';
    const crc = crc16(noCrc);
    return noCrc + crc;
}

function runPixCheckout() {
    const subtotalPix = state.cart.reduce((acc, it) => acc + ((it.price || PRODUCT_PRICE) * (it.quantity || 1)), 0);
    let freight = state.freight;
    if (state.appliedCoupon && (state.appliedCoupon.code === 'DEV5' || state.appliedCoupon.code === 'FLEXZERO')) freight = 0;
    const discount = state.appliedCoupon ? (subtotalPix + freight) * state.appliedCoupon.value : 0;
    const final = Number((subtotalPix + freight - discount).toFixed(2));
    const container = document.getElementById('pix-container');
    const sum = document.getElementById('pix-summary');
    const codeEl = document.getElementById('pix-code');
    const keyEl = document.getElementById('pix-key');
    const timerEl = document.getElementById('pix-timer');
    const copyBtn = document.getElementById('pix-copy');
    const regenBtn = document.getElementById('pix-regenerate');
    const paidBtn = document.getElementById('pix-paid');
    if (container) container.classList.remove('hidden');
    const color = state.cart[0]?.color || state.selectedColor || 'Preto';
    if (sum) sum.innerHTML = `Produto: SPIKE GLASSES<br>Cor: ${color}<br>Quantidade: ${qty}<br>Frete: ${formatBRL(freight)}<br>Cupom: ${state.appliedCoupon ? state.appliedCoupon.code : 'Nenhum'}<br>Total: <strong>${formatBRL(final)}</strong>`;
    const reference = String(Date.now());
    const payload = generatePixPayload(PIX_KEY, STORE_NAME, STORE_CITY, final, reference);
    if (codeEl) codeEl.innerText = payload;
    if (keyEl) keyEl.innerText = PIX_KEY;
    if (copyBtn) {
        copyBtn.onclick = async () => {
            try { await navigator.clipboard.writeText(payload); showModal('Copiado', 'Código copiado!'); } catch {}
        };
    }
    const gBtn = document.getElementById('gen-payment');
    const mpPaid = document.getElementById('paid-btn');
    if (gBtn) gBtn.classList.add('hidden');
    if (mpPaid) mpPaid.classList.add('hidden');
    const expiresAt = Date.now() + 15 * 60 * 1000;
    function tick() {
        const left = Math.max(0, expiresAt - Date.now());
        const m = Math.floor(left / 60000).toString().padStart(2, '0');
        const s = Math.floor((left % 60000) / 1000).toString().padStart(2, '0');
        if (timerEl) timerEl.innerText = `Este código PIX expira em ${m}:${s}`;
        if (left <= 0) {
            clearInterval(t);
            if (regenBtn) regenBtn.style.display = 'inline-block';
        }
    }
    const t = setInterval(tick, 1000); tick();
    if (regenBtn) {
        regenBtn.onclick = () => {
            regenBtn.style.display = 'none';
            runPixCheckout();
        };
    }
    if (paidBtn) {
        paidBtn.onclick = () => {
            if (state.orderSubmitting) return; // bloqueia cliques duplos
            showConfirmModal('Confirmação de Pagamento', 'Você confirma que realizou o pagamento via PIX?', () => {
                if (state.orderSubmitting) return; // bloqueia duplo clique no modal
                state.orderSubmitting = true;
                paidBtn.disabled = true;
                paidBtn.innerText = 'Processando...';
                const order = {
                    orderID: reference,
                    product: 'SPIKE GLASSES',
                    color: color,
                    quantity: qty,
                    shipping: freight,
                    coupon: state.appliedCoupon ? state.appliedCoupon.code : null,
                    finalPrice: final,
                    paymentMethod: 'PIX',
                    status: 'pending_payment_verification'
                };
                try {
                    const list = JSON.parse(localStorage.getItem('spikeOrders') || '[]');
                    list.push(order);
                    localStorage.setItem('spikeOrders', JSON.stringify(list));
                } catch {}
                sendToFormspree();
            });
        };
    }
}

async function generatePayment() {
    if (typeof PAYMENT_METHOD !== 'undefined' && PAYMENT_METHOD === 'PIX') {
        runPixCheckout();
        return;
    }
    const subtotal = state.cart.reduce((a, b) => a + ((b.price || PRODUCT_PRICE) * (b.quantity || 1)), 0);
    // Include freight in discount calculation
    const discountableAmount = subtotal + state.freight;
    const discount = (state.appliedCoupon ? discountableAmount * state.appliedCoupon.value : 0).toFixed(2);

    // Construct Mercado Pago Items
    const mpItems = state.cart.map(item => ({
        title: `Óculos Spike - ${item.color}`,
        unit_price: Number(item.price),
        quantity: Number(item.quantity),
        currency_id: 'BRL'
    }));

    // Add Shipping
    let finalFreight = state.freight;
    if (state.appliedCoupon && (state.appliedCoupon.code === 'DEV5' || state.appliedCoupon.code === 'FLEXZERO')) {
        finalFreight = 0;
    }

    if (finalFreight > 0) {
        mpItems.push({
            title: 'Frete',
            unit_price: Number(finalFreight),
            quantity: 1,
            currency_id: 'BRL'
        });
    }

    // Add Discount
    if (discount > 0) {
        mpItems.push({
            title: `Desconto Cupom (${state.appliedCoupon.code})`,
            unit_price: -Number(discount),
            quantity: 1,
            currency_id: 'BRL'
        });
    }

    const preference = {
        items: mpItems,
        payer: {
            name: state.userData.nome,
            email: state.userData.email,
            identification: {
                type: 'CPF',
                number: state.userData.cpf.replace(/\D/g, '')
            },
            address: {
                street_name: state.userData.rua,
                street_number: Number(state.userData.numero) || 0,
                zip_code: state.userData.cep.replace(/\D/g, '')
            }
        },
        back_urls: {
            success: window.location.href.split('checkout.html')[0] + 'index.html?status=success',
            failure: window.location.href,
            pending: window.location.href
        },
        auto_return: 'approved',
    };

    console.log("Spike: Generating Payment (Frontend Only)...", preference);
    showModal('Redirecionando', 'Estamos preparando seu checkout seguro de pagamento...');

    try {
        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(preference)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Falha ao conectar com o serviço de pagamento');
        }

        const data = await response.json();

        if (data.init_point) {
            state.paymentGenerated = true;
            closeModal('generic-modal');

            // Open immediately to avoid popup blocker
            const payWin = window.open(data.init_point, '_blank');

            if (!payWin || payWin.closed || typeof payWin.closed === 'undefined') {
                // Fallback if blocked
                showModal('Atenção', 'O bloqueador de popups impediu a abertura automática. Clique no botão abaixo para ir ao pagamento.');
                const okBtn = document.getElementById('modal-ok');
                if (okBtn) {
                    okBtn.innerText = 'Ir para o Pagamento';
                    okBtn.onclick = () => {
                        window.open(data.init_point, '_blank');
                        showPaidButton();
                    };
                }
            } else {
                showModal('Sucesso', 'O checkout abriu em uma nova aba. Conclua o pagamento por lá!');
                showPaidButton();
            }
        } else {
            throw new Error('Link de pagamento não recebido');
        }

    } catch (error) {
        console.error("Spike: MP Error", error);
        showModal('Erro no Checkout', 'Não conseguimos gerar o link de pagamento. Verifique sua conexão ou tente novamente mais tarde.');
    }
}

function showPaidButton() {
    state.paymentGenerated = true;
    localStorage.setItem('spikePaymentGenerated', 'true'); // Persist so it survives page reload
    const pBtn = document.getElementById('paid-btn');
    const gBtn = document.getElementById('gen-payment');
    if (pBtn) pBtn.classList.remove('hidden');
    if (gBtn) gBtn.classList.add('hidden');
}

function handlePaidConfirmation() {
    if (state.orderSubmitting) return;
    showConfirmModal('Confirmação de Pagamento', 'Você confirma que realizou o pagamento?', () => {
        if (state.orderSubmitting) return;
        state.orderSubmitting = true;
        const pBtn = document.getElementById('paid-btn');
        if (pBtn) { pBtn.disabled = true; pBtn.innerText = 'Processando...'; }
        sendToFormspree();
    });
}

async function gerarCodigoPedido() {
    const ano = new Date().getFullYear();
    try {
        const res = await fetch('https://script.google.com/macros/s/AKfycbwTMyWKVyeSoh0YbQupIniFom7PTj0LeEhGxTRyePiTBbBW__LfWuNwPRp_5ng7og2wTg/exec');
        const data = await res.json();
        if (data.success && data.pedidos && data.pedidos.length > 0) {
            const codigos = data.pedidos
                .map(p => p['Código'] || '')
                .filter(c => c.startsWith('SS-'))
                .map(c => parseInt(c.split('-')[2]) || 0);
            const ultimo = codigos.length > 0 ? Math.max(...codigos) : 0;
            const seq = ultimo + 1;
            localStorage.setItem('spikeOrderSeq', seq);
            return `SS-${ano}-${String(seq).padStart(4, '0')}`;
        }
    } catch (err) {
        console.warn('Spike: fallback localStorage para código:', err);
    }
    // Fallback se a planilha não responder
    const seq = (parseInt(localStorage.getItem('spikeOrderSeq') || '0') + 1);
    localStorage.setItem('spikeOrderSeq', seq);
    return `SS-${ano}-${String(seq).padStart(4, '0')}`;
}

async function sendToFormspree() {
    showModal('Enviando', 'Finalizando seu pedido...');
    const totalVal = document.getElementById('summary-total')?.innerText || "0,00";
    const subtotalVal = document.getElementById('summary-subtotal')?.innerText || "0,00";
    const freightVal = document.getElementById('summary-freight')?.innerText || "0,00";
    const discountVal = document.getElementById('summary-discount')?.innerText || "0,00";

    const codigoPedido = await gerarCodigoPedido();

    // Organize items for a clean email
    const itemsDescription = state.cart.map(item =>
        `- ${item.color} (Qtd: ${item.quantity}) - R$ ${(item.quantity * (item.price || PRODUCT_PRICE)).toFixed(2)}`
    ).join('\n');

    const formData = {
        subject: `Novo Pedido ${codigoPedido} - SKISEASON`,
        _message: `NOVO PEDIDO RECEBIDO:\n\n` +
            `Código do Pedido: ${codigoPedido}\n` +
            `Cliente: ${state.userData.nome}\n` +
            `CPF: ${state.userData.cpf}\n` +
            `E-mail: ${state.userData.email}\n` +
            `WhatsApp: ${state.userData.telefone}\n\n` +
            `ENDEREÇO:\n` +
            `${state.userData.rua}, ${state.userData.numero} ${state.userData.complemento ? '(' + state.userData.complemento + ')' : ''}\n` +
            `${state.userData.bairro} - ${state.userData.cidade}/${state.userData.estado} - CEP: ${state.userData.cep}\n\n` +
            `PRODUTOS:\n${itemsDescription}\n\n` +
            `---------------------------\n` +
            `Subtotal: ${subtotalVal}\n` +
            `Frete: ${freightVal}\n` +
            `Desconto: ${discountVal}\n` +
            `TOTAL: ${totalVal}\n` +
            `Cupom Usado: ${state.appliedCoupon ? state.appliedCoupon.code : 'Nenhum'}`,
        cliente_nome: state.userData.nome,
        cliente_email: state.userData.email,
        total_pago: totalVal,
        codigo_pedido: codigoPedido
    };

    const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwTMyWKVyeSoh0YbQupIniFom7PTj0LeEhGxTRyePiTBbBW__LfWuNwPRp_5ng7og2wTg/exec';

    const sheetsData = {
        codigo_pedido: codigoPedido,
        nome: state.userData.nome,
        email: state.userData.email,
        telefone: state.userData.telefone,
        cpf: state.userData.cpf,
        rua: state.userData.rua,
        numero: state.userData.numero,
        complemento: state.userData.complemento || '',
        bairro: state.userData.bairro,
        cidade: state.userData.cidade,
        estado: state.userData.estado,
        cep: state.userData.cep,
        produtos: state.cart.map(i => `${i.color} x${i.quantity}`).join(', '),
        total: totalVal
    };

        // --- COPIE E SUBSTITUA NO CHECKOUT.JS ---
try {
    // Chave da conta onde está o template de Compra Confirmada
    const PUBLIC_KEY_74K = "74K-UVW-EQCEZ0BET"; 

    const emailParams = {
        to_email: state.userData.email,
        codigo_pedido: codigoPedido
    };

    console.log("Enviando confirmação via conta 74K...");

    // Passar a chave como 4º parâmetro resolve o erro de "User ID required"
    await emailjs.send(
        "service_0oibu1g", 
        "template_x19kk6a", 
        emailParams, 
        PUBLIC_KEY_74K 
    );
    
    console.log("E-mail enviado com sucesso!");
} catch (emailErr) {
    console.error("Erro no EmailJS:", emailErr);
}
// --- FIM DO BLOCO ---

    // 2️⃣ Envia os dados silenciosamente para você no Formspree
    try {
        const response = await fetch(CONFIG.FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            localStorage.removeItem('spikeCart');
            localStorage.removeItem('spikeUserData');
            localStorage.removeItem('spikeStep');
            localStorage.removeItem('spikePaymentGenerated');

            // Salva pedido no Google Sheets
            try {
                await fetch(SHEETS_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sheetsData)
                });
            } catch (sheetErr) {
                console.warn('Spike: Google Sheets falhou:', sheetErr);
            }

            showModal('Pedido Confirmado!',
                `<strong>Seu pedido foi recebido com sucesso!</strong><br><br>` +
                `🧾 Código do pedido: <strong style="color: var(--primary-purple);">${codigoPedido}</strong><br><br>` +
                '⚠ AVISO DE PRODUÇÃO: Devido ao processo artesanal premium, os óculos levam aproximadamente 30 dias para serem produzidos + o tempo de envio dos correios.<br><br>' +
                'Você receberá um e-mail com o código de rastreio assim que seu pedido for postado. Qualquer dúvida, entre em contato com nosso suporte no menu superior.');

            const success = document.getElementById('success-screen');
            if (success) success.classList.add('active');
        } else {
            showModal('Erro', 'Houve um erro no envio. Tente novamente mais tarde.');
        }
    } catch (e) {
        showModal('Erro', 'Erro de conexão.');
    }
}

// --- Utils ---
function setStep(num) {
    state.currentStep = num;
    localStorage.setItem('spikeStep', num);

    document.querySelectorAll('.progress-step').forEach((s, idx) => {
        if (idx + 1 <= num) s.classList.add('active');
        else s.classList.remove('active');
    });

    document.querySelectorAll('.checkout-step').forEach((s, idx) => {
        if (idx + 1 === num) s.classList.remove('hidden');
        else s.classList.add('hidden');
    });

    if (num === 3) updateSummary();
}

function restoreStep() {
    const savedStep = parseInt(localStorage.getItem('spikeStep'));
    if (savedStep && state.cart.length > 0) {
        setStep(savedStep);
    }

    // Restore payment state so paid-btn reappears after returning from the bank
    if (localStorage.getItem('spikePaymentGenerated') === 'true') {
        showPaidButton();
    }

    if (state.userData) {
        Object.keys(state.userData).forEach(f => {
            const el = document.getElementById(f);
            if (el) el.value = state.userData[f];
        });
        if (state.userData.estado) {
            state.freight = SHIPPING_VALUES[state.userData.estado] || 25;
        }
    }
}

function showModal(title, msg) {
    const t = document.getElementById('modal-title');
    const m = document.getElementById('modal-msg');
    const c = document.getElementById('modal-cancel');
    const mod = document.getElementById('generic-modal');

    if (t) t.innerText = title;
    if (m) m.innerHTML = msg.replace(/\n/g, '<br>');
    if (c) c.style.display = 'none';
    if (mod) mod.classList.add('active');
}

function showConfirmModal(title, msg, onConfirm) {
    const t = document.getElementById('modal-title');
    const m = document.getElementById('modal-msg');
    const c = document.getElementById('modal-cancel');
    const ok = document.getElementById('modal-ok');
    const mod = document.getElementById('generic-modal');

    if (t) t.innerText = title;
    if (m) m.innerText = msg;
    if (c) c.style.display = 'block';
    if (ok) ok.innerText = 'Confirmar';
    if (mod) mod.classList.add('active');

    if (ok) {
        const newOk = ok.cloneNode(true);
        ok.parentNode.replaceChild(newOk, ok);
        newOk.addEventListener('click', () => {
            onConfirm();
            closeModal('generic-modal');
        });
    }
}

function closeModal(id) {
    const mod = document.getElementById(id);
    if (mod) mod.classList.remove('active');
    const ok = document.getElementById('modal-ok');
    if (ok) ok.innerText = 'OK';
}
