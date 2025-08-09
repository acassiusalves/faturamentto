export const systemFields = [
    { key: "sale_id", name: "ID da Venda", required: true, description: "Identificador único da transação de venda."},
    { key: "order_id", name: "ID do Pedido", required: true, description: "Número do pedido no marketplace de origem."},
    { key: "sale_date", name: "Data da Venda", required: true, description: "Data em que a venda foi realizada."},
    { key: "item_sku", name: "SKU do Produto", required: true, description: "Código de identificação do produto (SKU)."},
    { key: "item_title", name: "Nome do Produto", required: true, description: "Descrição ou título do produto vendido."},
    { key: "item_quantity", name: "Quantidade", required: true, description: "Número de unidades do produto vendidas."},
    { key: "gross_value", name: "Valor Bruto", required: true, description: "Valor total da venda antes de deduções."},
    { key: "marketplace_fee", name: "Taxa do Marketplace", required: false, description: "Taxa cobrada pelo marketplace sobre a venda."},
    { key: "shipping_cost", name: "Custo de Envio", required: false, description: "Valor pago pelo frete do produto."},
    { key: "customer_name", name: "Nome do Cliente", required: false, description: "Nome do comprador."},
    { key: "customer_document", name: "