
// Substitua o conteúdo de src/lib/ideris-fields.ts por este:

export const iderisFields: { key: string; label: string, path: string }[] = [
    // Order Details
    { key: "order_id", label: "ID do Pedido", path: "id" },
    { key: "order_code", label: "Código do Pedido", path: "code" },
    { key: "marketplace_name", label: "Nome do Marketplace", path: "marketplaceName" },
    { key: "auth_name", label: "Nome da Conta", path: "authenticationName" },
    { key: "document_value", label: "CPF/CNPJ do Cliente", path: "documentValue" },
    { key: "state_name", label: "Estado", path: "stateName" },
    { key: "status", label: "Status do Pedido", path: "statusDescription" }, 
    
    // Shipping Details
    { key: "deliveryTrackingCode", label: "Código de Rastreio", path: "deliveryTrackingCode" },
    { key: "deliveryType", label: "Tipo de Frete", path: "deliveryType" },

    // Dates
    { key: "sent_date", label: "Data de Envio", path: "sent" },
    { key: "payment_approved_date", label: "Data de Aprovação (Pagamento)", path: "payments[0].approved" },
    
    // Financial Values
    { key: "value_with_shipping", label: "Valor com Frete", path: "valueWithShipping" },
    { key: "paid_amount", label: "Valor Pago", path: "paidAmount" },
    { key: "fee_shipment", label: "Taxa de Frete", path: "feeShipment" },
    { key: "fee_order", label: "Taxa do Pedido (Comissão)", path: "feeOrder" },
    { key: "net_amount", label: "Valor Líquido", path: "netAmount" },
    { key: "discount", label: "Desconto", path: "discount" },
    { key: "discount_marketplace", label: "Desconto do Marketplace", path: "discountMarketplace" },
    { key: "left_over", label: "Sobra (Lucro)", path: "leftOver" },
    
    // Item Details (from first item)
    { key: "item_title", label: "Nome do Produto (Item)", path: "items[0].title" },
    { key: "item_sku", label: "SKU (Item)", path: "items[0].sku" },
    { key: "item_quantity", label: "Quantidade (Item)", path: "items[0].quantity" },
    { key: "item_image", label: "Imagem", path: "items[0].image" },

    // Customer and Address
    { key: "customer_name", label: "Nome do Cliente", path: "customerFirstName" },
    { key: "address_line", label: "Endereço", path: "addressLine" },
    { key: "address_zip_code", label: "CEP", path: "addressZipCode" },
    { key: "address_district", label: "Bairro", path: "districtName" },
    { key: "address_city", label: "Cidade", path: "cityName" },
    
    // New Fields
    { key: "customerLastName", label: "Sobrenome do Cliente", path: "customerLastName" },
    { key: "customerNickname", label: "Apelido do Cliente", path: "customerNickname" },
    { key: "customerEmail", label: "Email do Cliente", path: "customerEmail" },
    { key: "documentType", label: "Tipo do Documento", path: "documentType" },
    { key: "phoneAreaCode", label: "DDD", path: "phoneAreaCode" },
    { key: "phoneNumber", label: "Telefone", path: "phoneNumber" },
    { key: "addressStreet", label: "Rua", path: "addressStreet" },
    { key: "addressNumber", label: "Número", path: "addressNumber" },
    { key: "stateAbbreviation", label: "Sigla do Estado", path: "stateAbbreviation" },
    { key: "countryName", label: "País", path: "countryName" },
    { key: "addressComment", label: "Comentário do Endereço", path: "addressComment" },
    { key: "addressReceiverName", label: "Nome do Destinatário", path: "addressReceiverName" },
    { key: "addressReceiverPhone", label: "Telefone do Destinatário", path: "addressReceiverPhone" },
];
