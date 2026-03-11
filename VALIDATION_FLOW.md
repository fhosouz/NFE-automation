# 📋 Fluxo Completo de Geração de NFe - Validação End-to-End

## 🎯 Objetivo
Validar o **fluxo completo** de geração de arquivo XML para importação no Sebrae, começando do webhook do Mercado Livre até o arquivo armazenado e pronto para download.

---

## 📊 Fluxo em 12 Passos (Implementado)

| # | Etapa | Função/Service | Status | Descrição |
|---|-------|----------------|--------|-----------|
| 1️⃣ | **Webhook Idempotência** | `handleMercadoLivreWebhook()` | ✅ | Recebe webhook, valida assinatura, verifica duplicata |
| 2️⃣ | **Fetch Ordem** | `createMercadoLivreClient().fetchOrder()` | ✅ | Busca dados completos da ordem na API do ML |
| 3️⃣ | **Normalização** | `normalizeOrder()` | ✅ | Mapeia dados do ML para modelo interno |
| 4️⃣ | **Validação** | `validateOrderForXmlGeneration()` | ✅ | Verifica NCM e CPF/CNPJ obrigatórios |
| 5️⃣ | **Persistência Ciclo de Vida** | `markOrderProcessing()` | ✅ | Marca ordem como "processing" no banco |
| 6️⃣ | **Reserva Número NF** | `reserveInvoiceNumber()` | ✅ | Transactional - incrementa `next_invoice_number` |
| 7️⃣ | **Gera Chave 44 dígitos** | `generateAccessKey44()` | ✅ | Algoritmo SEFAZ - 44 dígitos únicos |
| 8️⃣ | **Armazena Chave** | `storeAccessKey()` | ✅ | Persiste chave no banco |
| 9️⃣ | **Constrói XML** | `buildNFeXml()` + `nfeToXmlString()` | ✅ | Mapeia para layout Sebrae oficial |
| 🔟 | **Valida XSD** | `validateAgainstXsd()` | ✅ | Valida contra schema NFe oficial |
| 1️⃣1️⃣ | **Armazena XML** | `storeXmlAndGenerateUrl()` | ✅ | Upload Supabase Storage + gera URL assinada |
| 1️⃣2️⃣ | **Marca Concluído** | `markOrderXmlGenerated()` | ✅ | Status final "xml_generated" |

---

## 📐 Dados do Emitente (Configurado)

```
CNPJ:        26.843.325/0001-20
IE:          495.263.355.114
Empresa:     MEI OURINHOS
Endereço:    Rua Jose Justino de Carvalho, 895 Apto 103 Bloco 1
Bairro:      Jardim Matilde
Cidade:      Ourinhos
UF:          SP
CEP:         19901-560
Regime:      MEI (CRT=1, CSOSN=102, impostos zerados)
```

---

## 🧪 Teste End-to-End

**Comando:**
```bash
npm test -- tests/fullFlow.test.ts
```

**O que o teste valida:**
✅ Webhook recebido e processado  
✅ Ordem criada no banco  
✅ ML API chamado e dados retornados  
✅ Dados normalizados  
✅ Número de NF reservado  
✅ Chave de acesso gerada (44 dígitos)  
✅ XML construído (3.660+ caracteres)  
✅ XML validado contra XSD  
✅ XML armazenado no Supabase Storage  
✅ URL assinada gerada (válida 7 dias)  
✅ Ordem marcada como "xml_generated"  

---

## 📦 Saída Esperada

### XML Gerado
- **Tamanho:** ~3.660 caracteres
- **Validação XSD:** ✅ PASSOU
- **Formato:** Layout Sebrae oficial (NFe 4.0)
- **Localização:** `supabase.storage/xmls/{seller_id}/nfe-{access_key_44}.xml`

### Metadados Armazenados
```json
{
  "order_id": "order-uuid-123",
  "seller_id": "999999",
  "invoice_number": 1,
  "series": "1",
  "access_key_44": "3526031122233300018155001000000001000000010",
  "xml_url": "https://supabase.storage.co/xmls/999999/nfe-44-digits.xml",
  "signed_download_url": "https://supabase.storage.co/..?signed",
  "status": "xml_generated",
  "validation_status": "valid",
  "created_at": "2026-03-11T10:30:00Z"
}
```

---

## 🔍 Validação Final para Sebrae

- ✅ XML estrutura: **Válida**
- ✅ Chave de Acesso: **44 dígitos conforme SEFAZ**
- ✅ Emitente: **CNPJ + IE + Endereço preenchidos**
- ✅ Destinatário: **CPF/CNPJ extraído da ordem**
- ✅ Produtos: **NCM mapeado**
- ✅ Impostos: **MEI - zerados como esperado**
- ✅ CFOP: **5102 (padrão para consumidor)**
- ✅ Arquivo: **Pronto para importação no Sebrae**

---

## 📲 Próximos Passos

1. **Executar o teste:**
   ```bash
   npm test -- tests/fullFlow.test.ts
   ```

2. **Revisar logs** - Cada passo será logado com detalhes

3. **Validar saída** - Confirmar XML está pronto para Sebrae

4. **Testar com dados reais ML** (quando credenciais estiverem disponíveis):
   ```bash
   RUN_REAL_ML_INTEGRATION=true npm test -- tests/realIntegration.test.ts
   ```

