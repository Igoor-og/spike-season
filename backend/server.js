const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos (HTML, CSS, JS, Assets)
app.use(express.static(path.join(__dirname, '../')));

// Endpoint de Health Check (para o ping anti-cold start)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Endpoint de Cálculo de Frete
app.post('/calculate', async (req, res) => {
    const { cep, items } = req.body;

    if (!cep) {
        return res.status(400).json({ error: 'CEP é obrigatório' });
    }

    try {
        // TOKEN DO MELHOR ENVIO
        // Você deve configurar a variável de ambiente MELHOR_ENVIO_TOKEN no Render
        const token = process.env.MELHOR_ENVIO_TOKEN;
        const fromCep = process.env.ORIGIN_CEP || '01001000'; // CEP de origem (padrão ou configurado)

        if (!token) {
            console.log('Token do Melhor Envio não configurado. Retornando valor fixo para teste.');
            // Retorno fake para teste se não tiver token configurado
            return res.json({
                name: 'PAC (Simulado)',
                company: 'Correios',
                price: 25.50,
                days: 5
            });
        }

        // Se tiver token, faz a chamada real para a API do Melhor Envio
        // (Lógica simplificada - adaptaremos conforme a necessidade real de payload)
        // Documentação: https://docs.melhorenvio.com.br/

        /* 
        Exemplo de payload real:
        const response = await axios.post(
            'https://melhorenvio.com.br/api/v2/me/shipment/calculate',
            {
                from: { postal_code: fromCep },
                to: { postal_code: cep },
                products: [
                    { width: 15, height: 5, length: 20, weight: 0.3, insurance_value: 110.0, quantity: 1 }
                ]
            },
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        // Processar resposta do Melhor Envio e retornar o melhor frete
        */

        // Por enquanto, mantendo o fallback simulado até você colocar o token
        return res.json({
            name: 'Frete Calculado',
            company: 'Melhor Envio',
            price: 22.90, // Exemplo
            days: 4
        });

    } catch (error) {
        console.error('Erro no cálculo de frete:', error);
        res.status(500).json({ error: 'Erro ao calcular frete' });
    }
});

// Endpoint de Criação de Preferência de Pagamento (Mercado Pago)
app.post('/create_preference', async (req, res) => {
    try {
        const { items, payer, returnUrl } = req.body;

        // TOKEN DO MERCADO PAGO
        // Você deve configurar a variável de ambiente MP_ACCESS_TOKEN no Render
        // Se não tiver, vai tentar usar o do config.js (não recomendado para produção real, mas serve para teste)
        const mpAccessToken = process.env.MP_ACCESS_TOKEN || 'APP_USR-7560521507129293-012718-a4d8dcc15699d84347172d35a67be41c-287367066';

        const preferenceData = {
            items: items,
            payer: payer,
            back_urls: {
                success: returnUrl,
                failure: returnUrl,
                pending: returnUrl
            },
            auto_return: 'approved'
        };

        const response = await axios.post(
            'https://api.mercadopago.com/checkout/preferences',
            preferenceData,
            {
                headers: {
                    'Authorization': `Bearer ${mpAccessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(response.data);

    } catch (error) {
        console.error('Erro ao criar preferência MP:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Erro ao criar preferência de pagamento' });
    }
});

// Rota coringa para servir o index.html em qualquer outra rota (SPA like, se fosse react)
// Mas como é estático multi-page, isso garante que a raiz carregue
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
