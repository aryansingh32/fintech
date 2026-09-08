import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, PrimaryButton } from '@/components/ui';
import { useAddIdentifier, useCreateProduct, useProducts } from '@/hooks/useApi';
import { formatMoney } from '@/utils/format';
import { ApiError, Product } from '@sptc/shared';

/**
 * Add new phone/device catalog entries and register the specific physical
 * units (IMEI/serial) that get financed against them. Without this screen
 * there is no way to get inventory into the system at all - CreateLoanScreen
 * can only search identifiers that already exist.
 */
export function InventoryProductsScreen() {
  const { data: products, isLoading, refetch } = useProducts();
  const createProduct = useCreateProduct();
  const [creating, setCreating] = useState(false);
  const [addingUnitTo, setAddingUnitTo] = useState<Product | null>(null);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [financePrice, setFinancePrice] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('');

  const resetForm = () => {
    setBrand('');
    setModel('');
    setCategory('');
    setSku('');
    setPurchasePrice('');
    setSellingPrice('');
    setFinancePrice('');
    setWarrantyMonths('');
  };

  const onCreate = async () => {
    try {
      await createProduct.mutateAsync({
        brand: brand.trim(),
        model: model.trim(),
        category: category.trim(),
        sku: sku.trim(),
        purchasePrice: Number(purchasePrice),
        sellingPrice: Number(sellingPrice),
        financePrice: Number(financePrice),
        warrantyMonths: warrantyMonths.trim() ? Number(warrantyMonths) : undefined,
      });
      resetForm();
      setCreating(false);
      refetch();
    } catch (err) {
      Alert.alert('Could not add product', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Inventory</Text>
      <Text style={styles.hint}>
        Add phone/device models here, then register each physical unit's IMEI or serial number so it can be
        financed. Loan creation searches these units by IMEI/serial.
      </Text>

      {isLoading ? <Text style={styles.caption}>Loading...</Text> : null}

      {(products ?? []).map((product) => (
        <Card key={product.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>
              {product.brand} {product.model}
            </Text>
            <Text style={styles.caption}>{product.category}</Text>
          </View>
          <Text style={styles.caption}>
            SKU {product.sku} · Finance price {formatMoney(product.financePrice)}
          </Text>
          <Text style={styles.caption}>{product.identifiers?.length ?? 0} unit(s) in stock</Text>
          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton label="Add Unit (IMEI/Serial)" onPress={() => setAddingUnitTo(product)} variant="secondary" />
          </View>
        </Card>
      ))}

      <Text style={styles.sectionTitle}>Add New Product</Text>
      {!creating ? (
        <PrimaryButton label="Add Product" onPress={() => setCreating(true)} />
      ) : (
        <Card>
          <TextInput value={brand} onChangeText={setBrand} placeholder="Brand (e.g. Samsung)" placeholderTextColor={colors.textSecondary} style={styles.input} />
          <TextInput
            value={model}
            onChangeText={setModel}
            placeholder="Model (e.g. Galaxy A15)"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { marginTop: spacing.md }]}
          />
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="Category (e.g. Smartphone)"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { marginTop: spacing.md }]}
          />
          <TextInput
            value={sku}
            onChangeText={setSku}
            placeholder="SKU"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { marginTop: spacing.md }]}
          />
          <View style={styles.rowInputs}>
            <TextInput
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              placeholder="Purchase price"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.rowInput]}
            />
            <TextInput
              value={sellingPrice}
              onChangeText={setSellingPrice}
              placeholder="Selling price"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.rowInput]}
            />
          </View>
          <View style={styles.rowInputs}>
            <TextInput
              value={financePrice}
              onChangeText={setFinancePrice}
              placeholder="Finance price"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.rowInput]}
            />
            <TextInput
              value={warrantyMonths}
              onChangeText={setWarrantyMonths}
              placeholder="Warranty (months)"
              keyboardType="number-pad"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.rowInput]}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Cancel" onPress={() => { setCreating(false); resetForm(); }} variant="secondary" />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Save Product"
                onPress={onCreate}
                loading={createProduct.isPending}
                disabled={!brand.trim() || !model.trim() || !category.trim() || !sku.trim() || !purchasePrice || !sellingPrice || !financePrice}
              />
            </View>
          </View>
        </Card>
      )}

      {addingUnitTo ? (
        <AddUnitModal product={addingUnitTo} onClose={() => setAddingUnitTo(null)} onAdded={refetch} />
      ) : null}
    </ScrollView>
  );
}

function AddUnitModal({ product, onClose, onAdded }: { product: Product; onClose: () => void; onAdded: () => void }) {
  const addIdentifier = useAddIdentifier();
  const [imei1, setImei1] = useState('');
  const [imei2, setImei2] = useState('');
  const [serialNumber, setSerialNumber] = useState('');

  const onSave = async () => {
    try {
      await addIdentifier.mutateAsync({
        productId: product.id,
        dto: {
          imei1: imei1.trim() || undefined,
          imei2: imei2.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
        },
      });
      onAdded();
      onClose();
    } catch (err) {
      Alert.alert('Could not add unit', err instanceof ApiError ? err.message : 'Please try again.');
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            Add Unit · {product.brand} {product.model}
          </Text>
          <Text style={styles.label}>IMEI 1</Text>
          <TextInput value={imei1} onChangeText={setImei1} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
          <Text style={[styles.label, { marginTop: spacing.md }]}>IMEI 2 (optional)</Text>
          <TextInput value={imei2} onChangeText={setImei2} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
          <Text style={[styles.label, { marginTop: spacing.md }]}>Serial Number (optional)</Text>
          <TextInput value={serialNumber} onChangeText={setSerialNumber} style={styles.input} placeholderTextColor={colors.textSecondary} />

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Add Unit"
                onPress={onSave}
                loading={addIdentifier.isPending}
                disabled={!imei1.trim() && !imei2.trim() && !serialNumber.trim()}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 18 },
  sectionTitle: { ...typography.bodyStrong, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...typography.bodyStrong, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  rowInputs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  rowInput: { flex: 1 },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.md },
});
