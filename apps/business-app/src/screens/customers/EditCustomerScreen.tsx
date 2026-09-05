import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { Card, ErrorState, LoadingState, PrimaryButton } from '@/components/ui';
import { useCustomer, useUpdateCustomer, useUploadFile } from '@/hooks/useApi';
import { RootStackParamList } from '@/navigation/types';
import { ApiError } from '@sptc/shared';

export function EditCustomerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditCustomer'>>();
  const { customerId } = route.params;

  const { data: customer, isLoading, isError, error, refetch } = useCustomer(customerId);
  const updateCustomer = useUpdateCustomer(customerId);
  const uploadFile = useUploadFile();

  if (isLoading || !customer) return <LoadingState label="Loading customer..." />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} onRetry={refetch} />;

  return <EditCustomerForm customer={customer} onDone={() => navigation.goBack()} updateCustomer={updateCustomer} uploadFile={uploadFile} />;
}

function EditCustomerForm({
  customer,
  onDone,
  updateCustomer,
  uploadFile,
}: {
  customer: NonNullable<ReturnType<typeof useCustomer>['data']>;
  onDone: () => void;
  updateCustomer: ReturnType<typeof useUpdateCustomer>;
  uploadFile: ReturnType<typeof useUploadFile>;
}) {
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email ?? '');
  const [addressLine1, setAddressLine1] = useState(customer.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(customer.addressLine2 ?? '');
  const [city, setCity] = useState(customer.city ?? '');
  const [state, setState] = useState(customer.state ?? '');
  const [pincode, setPincode] = useState(customer.pincode ?? '');
  const [referenceName, setReferenceName] = useState(customer.referenceName ?? '');
  const [referenceMobile, setReferenceMobile] = useState(customer.referenceMobile ?? '');

  const [customerPhoto, setCustomerPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
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

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const [photoUrl, referencePhotoUrl] = await Promise.all([
        customerPhoto
          ? uploadFile.mutateAsync({ uri: customerPhoto.uri, contentType: customerPhoto.mimeType ?? 'image/jpeg', purpose: 'customer-photo' })
          : Promise.resolve(undefined),
        referencePhoto
          ? uploadFile.mutateAsync({ uri: referencePhoto.uri, contentType: referencePhoto.mimeType ?? 'image/jpeg', purpose: 'reference-photo' })
          : Promise.resolve(undefined),
      ]);

      await updateCustomer.mutateAsync({
        name: name.trim(),
        email: email.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pincode: pincode.trim() || undefined,
        referenceName: referenceName.trim() || undefined,
        referenceMobile: referenceMobile.trim() || undefined,
        ...(photoUrl ? { photoUrl } : {}),
        ...(referencePhotoUrl ? { referencePhotoUrl } : {}),
      });
      onDone();
    } catch (err) {
      Alert.alert('Could not save changes', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <PhotoPicker
          label="Customer Photo"
          asset={customerPhoto}
          existingUrl={customer.photoUrl}
          onPress={() => pickImage(setCustomerPhoto)}
          round
        />
      </Card>

      <Text style={styles.sectionTitle}>Basic Info</Text>
      <Card>
        <Field label="Full Name" value={name} onChangeText={setName} />
        <Field label="Email" value={email} onChangeText={setEmail} last />
      </Card>

      <Text style={styles.sectionTitle}>Address</Text>
      <Card>
        <Field label="Address Line 1" value={addressLine1} onChangeText={setAddressLine1} />
        <Field label="Address Line 2" value={addressLine2} onChangeText={setAddressLine2} />
        <Field label="City" value={city} onChangeText={setCity} />
        <Field label="State" value={state} onChangeText={setState} />
        <Field label="Pincode" value={pincode} onChangeText={setPincode} keyboardType="phone-pad" last />
      </Card>

      <Text style={styles.sectionTitle}>Reference Contact</Text>
      <Card>
        <Field label="Reference Name" value={referenceName} onChangeText={setReferenceName} />
        <Field label="Reference Mobile" value={referenceMobile} onChangeText={setReferenceMobile} keyboardType="phone-pad" />
        <PhotoPicker
          label="Reference Photo"
          asset={referencePhoto}
          existingUrl={customer.referencePhotoUrl}
          onPress={() => pickImage(setReferencePhoto)}
        />
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label="Save Changes" onPress={onSubmit} loading={submitting || updateCustomer.isPending || uploadFile.isPending} />
      </View>
    </ScrollView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (v: string) => void; keyboardType?: 'phone-pad'; last?: boolean }) {
  return (
    <View style={{ marginBottom: props.last ? 0 : spacing.lg }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />
    </View>
  );
}

function PhotoPicker({
  label,
  asset,
  existingUrl,
  onPress,
  round,
}: {
  label: string;
  asset: ImagePicker.ImagePickerAsset | null;
  existingUrl?: string | null;
  onPress: () => void;
  round?: boolean;
}) {
  const uri = asset?.uri ?? existingUrl ?? undefined;
  return (
    <Pressable onPress={onPress} style={styles.photoRow}>
      <View style={[styles.photoThumb, round && styles.photoThumbRound]}>
        {uri ? <Image source={{ uri }} style={[styles.photoImg, round && styles.photoThumbRound]} /> : <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />}
      </View>
      <Text style={styles.photoLabel}>{uri ? 'Change photo' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  sectionTitle: { ...typography.captionStrong, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase' },
  label: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.sm },
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
});
