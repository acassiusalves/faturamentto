// This file defines the fields available from the Ideris API.
// The key is a unique identifier we'll use internally.
// The label is the user-friendly name shown in the UI.
// The path is the dot-notation path to access the value in the Ideris order object.
export const iderisFields: { key: string; label: string, path: string }[] = [
    // Order Details
    { key: "order_id", label: "ID do Pedido", path: "id" },
    { key: "order_code", label: "Código do Pedido", path: "code" },
    { key: "marketplace_name", label: "Nome do Marketplace", path: "marketplaceName" },
    { key: "auth_name", label: "Nome da Conta", path: "authenticationName" },
    { key: "document_value", label: "CPF/CNPJ do Cliente", path: "documentValue" },
    { key: "state_name", label: "Estado", path: "stateName" },
    { key: "status", label: "Status do Pedido", path: "status" },

    // Financial Values
    { key: "value_with_shipping", label: "Valor com Frete", path: "valueWithShipping" },
    { key: "paid_amount", label: "Valor Pago", path: "paidAmount" },
    { key: "fee_shipment", label: "Taxa de Frete", path: "feeShipment" },
    { key: "fee_order", label: "Taxa do Pedido (Comissão)", path: "feeOrder" },
    { key: "net_amount", label: "Valor Líquido", path: "netAmount" },
    { key: "left_over", label: "Lucro (sobra)", path: "leftOver" },
    { key: "discount", label: "Desconto", path: "discount" },
    { key: "discount_marketplace", label: "Desconto do Marketplace", path: "discountMarketplace" },
    
    // Item Details (from first item)
    { key: "item_title", label: "Nome do Produto (Item)", path: "items[0].title" },
    { key: "item_sku", label: "SKU (Item)", path: "items[0].sku" },
    { key: "item_quantity", label: "Quantidade (Item)", path: "items[0].quantity" },
    { key: "item_image", label: "Imagem", path: "items[0].image" },

    // Payment Details (from first payment)
    { key: "payment_approved_date", label: "Data de Aprovação (Pagamento)", path: "payments[0].approved" },
];
