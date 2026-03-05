const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Mercado Pago Access Token
const ACCESS_TOKEN = 'APP_USR-7560521507129293-012718-a4d8dcc15699d84347172d35a67be41c-287367066';

app.post('/create-preference', async (req, res) => {
    try {
        const { items, freight, userData, coupon } = req.body;

        // Construct items for MP
        const mpItems = items.map(item => ({
            title: `Óculos Spike - ${item.color}`,
            unit_price: Number(item.price),
            quantity: Number(item.quantity),
            currency_id: 'BRL'
        }));

        // Apply free shipping for FLEXZERO
        let finalFreight = Number(freight) || 0;
        if (coupon && coupon.code === 'FLEXZERO') {
            finalFreight = 0;
        }

        // Add freight as an item
        if (finalFreight > 0) {
            mpItems.push({
                title: 'Frete',
                unit_price: Number(finalFreight),
                quantity: 1,
                currency_id: 'BRL'
            });
        }

        // Apply discount if exists (as a negative item or reduced price)
        // MP Preference items don't support "discounts" directly easily, 
        // usually we apply it to the items or add a negative price item.
        if (coupon && coupon.value) {
            const totalItemsPrice = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const discountValue = totalItemsPrice * coupon.value;
            mpItems.push({
                title: `Desconto Cupom (${coupon.code})`,
                unit_price: -Number(discountValue.toFixed(2)),
                quantity: 1,
                currency_id: 'BRL'
            });
        }

        const preference = {
            items: mpItems,
            payer: {
                name: userData.nome,
                email: userData.email,
                identification: {
                    type: 'CPF',
                    number: userData.cpf.replace(/\D/g, '')
                },
                address: {
                    street_name: userData.rua,
                    street_number: Number(userData.numero),
                    zip_code: userData.cep.replace(/\D/g, '')
                }
            },
            back_urls: {
                success: 'https://spike-season.github.io/success', // Update with real URLs
                failure: 'https://spike-season.github.io/failure',
                pending: 'https://spike-season.github.io/pending'
            },
            auto_return: 'approved',
        };

        const response = await axios.post('https://api.mercadopago.com/checkout/preferences', preference, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({ id: response.data.id, init_point: response.data.init_point });
    } catch (error) {
        console.error('MP Preference Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create preference' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
