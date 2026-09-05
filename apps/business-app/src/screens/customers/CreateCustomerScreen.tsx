import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, PrimaryButton } from '@/components/ui';
import { useCreateCustomer, useUploadFile } from '@/hooks/useApi';
import { apiClient } from '@/api/apiClient';
import { RootStackParamList } from '@/navigation/types';
import { ApiError, KycDocumentType } from '@sptc/shared';

interface KycDocDraft {
  type: KycDocumentType;
  maskedIdentifier: string;
  photo: ImagePicker.ImagePickerAsset | null;
}

const KYC_DOC_TYPES = [
  KycDocumentType.AADHAAR,
  KycDocumentType.PAN,
  KycDocumentType.VOTER_ID,
  KycDocumentType.DRIVING_LICENSE,
  KycDocumentType.PASSPORT,
  KycDocumentType.OTHER,
];

const KYC_DOC_LABEL: Record<KycDocumentType, string> = {
  [KycDocumentType.AADHAAR]: 'Aadhaar',
  [KycDocumentType.PAN]: 'PAN',
  [KycDocumentType.VOTER_ID]: 'Voter ID',
  [KycDocumentType.DRIVING_LICENSE]: 'Driving License',
  [KycDocumentType.PASSPORT]: 'Passport',
  [KycDocumentType.UTILITY_BILL]: 'Utility Bill',
  [KycDocumentType.OTHER]: 'Other',
};

export function CreateCustomerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const createCustomer = useCreateCustomer();
  const uploadFile = useUploadFile();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  const [kycDocs, setKycDocs] = useState<KycDocDraft[]>([{ type: KycDocumentType.AADHAAR, maskedIdentifier: '', photo: null }]);
  const [customerPhoto, setCustomerPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [referenceName, setReferenceName] = useState('');
  const [referenceMobile, setReferenceMobile] = useState('');
  const [referencePhoto, setReferencePhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const pickImage = async (onPicked: (asset: ImagePicker.ImagePickerAsset) => void) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets[0]) onPicked(result.assets[0]);
  };

  const upload = (asset: ImagePicker.ImagePickerAsset, purpose: 'customer-photo' | 'reference-photo' | 'kyc-document') =>
    uploadFile.mutateAsync({ uri: asset.uri, contentType: asset.mimeType ?? 'image/jpeg', purpose });

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const [photoUrl, referencePhotoUrl] = await Promise.all([
        customerPhoto ? upload(customerPhoto, 'customer-photo') : Promise.resolve(undefined),
        referencePhoto ? upload(referencePhoto, 'reference-photo') : Promise.resolve(undefined),
      ]);

      const customer = await createCustomer.mutateAsync({
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pincode: pincode.trim() || undefined,
        photoUrl,
        referenceName: referenceName.trim() || undefined,
        referenceMobile: referenceMobile.trim() || undefined,
        referencePhotoUrl,
      });

      for (const doc of kycDocs) {
        if (!doc.photo || !doc.maskedIdentifier.trim()) continue;
        const documentRef = await upload(doc.photo, 'kyc-document');
        await apiClient.kyc.submit(customer.id, {
          documentType: doc.type,
          maskedIdentifier: doc.maskedIdentifier.trim(),
          documentRef,
        });
      }

      navigation.replace('CustomerProfile', { customerId: customer.id });
    } catch (err) {
      Alert.alert('Could not create customer', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle title="Basic Info" />
      <Card>
        <Field label="Full Name" value={name} onChangeText={setName} placeholder="Rahul Sharma" />
        <Field label="Mobile Number" value={mobile} onChangeText={setMobile} placeholder="98765 43210" keyboardType="phone-pad" />
        <Field label="Email (optional)" value={email} onChangeText={setEmail} placeholder="rahul@email.com" last />
      </Card>

      <SectionTitle title="Address" />
      <Card>
        <Field label="Address Line 1" value={addressLine1} onChangeText={setAddressLine1} placeholder="Shop no. / Street" />
        <Field label="Address Line 2 (optional)" value={addressLine2} onChangeText={setAddressLine2} placeholder="Landmark" />
        <Field label="City" value={city} onChangeText={setCity} placeholder="Mumbai" />
        <Field label="State" value={state} onChangeText={setState} placeholder="Maharashtra" />
        <Field label="Pincode" value={pincode} onChangeText={setPincode} placeholder="400001" keyboardType="phone-pad" last />
      </Card>

      <SectionTitle title="Identity / KYC Documents" />
      {kycDocs.map((doc, index) => (
        <Card key={index} style={{ marginBottom: spacing.md }}>
          <View style={styles.docHeaderRow}>
            <Text style={styles.label}>Document Type</Text>
            {kycDocs.length > 1 ? (
              <Pressable onPress={() => setKycDocs((docs) => docs.filter((_, i) => i !== index))}>
                <Ionicons name="trash-outline" size={18} color={colors.statusOverdue} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.chipRow}>
            {KYC_DOC_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setKycDocs((docs) => docs.map((d, i) => (i === index ? { ...d, type: t } : d)))}
                style={[styles.chip, doc.type === t && styles.chipActive]}
              >
                <Text style={[styles.chipText, doc.type === t && styles.chipTextActive]}>{KYC_DOC_LABEL[t]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helper}>
            Enter only the last 4 digits/characters, e.g. XXXX XXXX 1234 - the full number is never stored.
          </Text>
          <Field
            label={`${KYC_DOC_LABEL[doc.type]} (masked)`}
            value={doc.maskedIdentifier}
            onChangeText={(v) => setKycDocs((docs) => docs.map((d, i) => (i === index ? { ...d, maskedIdentifier: v } : d)))}
            placeholder="XXXX XXXX 1234"
            last
          />
          <PhotoPicker
            label="Document Photo"
            asset={doc.photo}
            onPress={() => pickImage((asset) => setKycDocs((docs) => docs.map((d, i) => (i === index ? { ...d, photo: asset } : d))))}
          />
        </Card>
      ))}
      <Pressable
        onPress={() => setKycDocs((docs) => [...docs, { type: KycDocumentType.PAN, maskedIdentifier: '', photo: null }])}
        style={styles.addDocButton}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.brand} />
        <Text style={styles.addDocLabel}>Add another document (e.g. PAN)</Text>
      </Pressable>

      <SectionTitle title="Customer Photo" />
      <Card>
        <PhotoPicker label="Customer Photo" asset={customerPhoto} onPress={() => pickImage(setCustomerPhoto)} round />
      </Card>

      <SectionTitle title="Reference Contact" />
      <Card>
        <Field label="Reference Name" value={referenceName} onChangeText={setReferenceName} placeholder="Name of a known contact" />
        <Field
          label="Reference Mobile"
          value={referenceMobile}
          onChangeText={setReferenceMobile}
          placeholder="98765 43210"
          keyboardType="phone-pad"
          last
        />
        <PhotoPicker label="Reference Photo (optional)" asset={referencePhoto} onPress={() => pickImage(setReferencePhoto)} />
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton
          label="Create Customer"
          onPress={onSubmit}
          loading={submitting || createCustomer.isPending || uploadFile.isPending}
          disabled={!name.trim() || mobile.trim().length < 10}
        />
      </View>
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad';
  last?: boolean;
}) {
  return (
    <View style={{ marginBottom: props.last ? 0 : spacing.lg }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={props.keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function PhotoPicker({
  label,
  asset,
  onPress,
  round,
}: {
  label: string;
  asset: ImagePicker.ImagePickerAsset | null;
  onPress: () => void;
  round?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.photoRow}>
      <View style={[styles.photoThumb, round && styles.photoThumbRound]}>
        {asset ? (
          <Image source={{ uri: asset.uri }} style={[styles.photoImg, round && styles.photoThumbRound]} />
        ) : (
          <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
        )}
      </View>
      <Text style={styles.photoLabel}>{asset ? 'Change photo' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  sectionTitle: { ...typography.captionStrong, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase' },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
  helper: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photoThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoThumbRound: { borderRadius: 28 },
  photoImg: { width: 56, height: 56 },
  photoLabel: { ...typography.body, color: colors.textPrimary },
  docHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...typography.caption, color: colors.textPrimary },
  chipTextActive: { color: colors.textInverse },
  addDocButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  addDocLabel: { ...typography.bodyStrong, color: colors.brand },
});
