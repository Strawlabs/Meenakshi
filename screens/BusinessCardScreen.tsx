import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, Image, TextInput, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';
import { parseBusinessCard, saveBusinessCard, updateContact, BusinessCardData } from '../services/businessCardService';

type RoutePropType = RouteProp<RootStackParamList, 'BusinessCard'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function BusinessCardScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const origin = route.params?.origin;
  const editContactId = route.params?.editContactId;
  const editContactData = route.params?.editContactData;

  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<BusinessCardData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.base64) {
        const base64Str = result.assets[0].base64;
        const uri = result.assets[0].uri;
        
        if (origin === 'chat') {
          navigation.navigate({
            name: 'Chat',
            params: { scannedCardBase64: base64Str },
            merge: true,
          } as any);
          return;
        }
        setPhotoUri(uri);
        processCard(base64Str);
      }
    } catch (err: any) {
      console.error('Failed to pick image:', err);
      alert('Failed to pick image: ' + err.message);
    }
  };

  // Initialize if editing
  useEffect(() => {
    if (editContactId && editContactData) {
      setParsedData({
        name: editContactData.name || '',
        designation: editContactData.designation || '',
        organization: editContactData.organization || '',
        email: editContactData.email || '',
        phone: editContactData.phone || '',
        address: editContactData.address || '',
        notes: editContactData.notes || '',
      });
    }
  }, [editContactId, editContactData]);

  if (!permission && !editContactId) {
    return <View style={styles.container} />;
  }

  if (!permission?.granted && !editContactId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Meenakshi needs camera access to scan business cards.</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
        });
        if (photo?.base64) {
          if (origin === 'chat') {
            navigation.navigate({
              name: 'Chat',
              params: { scannedCardBase64: photo.base64 },
              merge: true,
            } as any);
            return;
          }
          setPhotoUri(photo.uri);
          processCard(photo.base64);
        }
      } catch (err) {
        console.error('Failed to take picture', err);
      }
    }
  };

  const processCard = async (base64Str: string) => {
    setIsProcessing(true);
    try {
      const data = await parseBusinessCard(base64Str);
      setParsedData({
        name: data.name || '',
        designation: data.designation || '',
        organization: data.organization || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        notes: '',
      });
    } catch (err: any) {
      console.error('Failed to parse card:', err);
      alert('Failed to parse card. ' + err.message);
      setPhotoUri(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!parsedData || !parsedData.name) {
      alert('Name is required');
      return;
    }
    setIsSaving(true);
    try {
      if (editContactId) {
        await updateContact(editContactId, parsedData);
        alert('Contact updated successfully!');
        navigation.goBack();
      } else {
        const contact = await saveBusinessCard(parsedData);
        alert('Contact saved successfully!');
        navigation.replace('ContactProfile', { contactId: contact.id });
      }
    } catch (err: any) {
      console.error('Failed to save contact:', err);
      alert('Failed to save: ' + err.message);
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editContactId ? 'Edit Contact' : parsedData ? 'Review Contact' : 'Scan Business Card'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {!parsedData ? (
        <>
          <View style={styles.cameraContainer}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.camera} />
            ) : (
              <CameraView style={styles.camera} facing="back" ref={cameraRef}>
                <View style={styles.overlay}>
                  <View style={styles.guideBox} />
                </View>
              </CameraView>
            )}
          </View>

          <View style={styles.controls}>
            {isProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.processingText}>Extracting details using AI...</Text>
              </View>
            ) : (
              !photoUri && (
                <View style={styles.controlsRow}>
                  {/* Gallery Button */}
                  <TouchableOpacity style={styles.galleryBtn} onPress={pickImage}>
                    <Text style={styles.galleryBtnText}>🖼️</Text>
                  </TouchableOpacity>

                  {/* Capture Button */}
                  <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                    <View style={styles.captureBtnInner} />
                  </TouchableOpacity>

                  {/* Dummy spacer to balance the gallery button on the left */}
                  <View style={styles.spacerBtn} />
                </View>
              )
            )}
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.formContainer}>
          <Text style={styles.formLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={parsedData.name}
            onChangeText={(text) => setParsedData({ ...parsedData, name: text })}
            placeholder="John Doe"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.formLabel}>Role / Designation</Text>
          <TextInput
            style={styles.input}
            value={parsedData.designation}
            onChangeText={(text) => setParsedData({ ...parsedData, designation: text })}
            placeholder="CEO"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.formLabel}>Organization</Text>
          <TextInput
            style={styles.input}
            value={parsedData.organization}
            onChangeText={(text) => setParsedData({ ...parsedData, organization: text })}
            placeholder="Acme Corp"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.formLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={parsedData.email}
            onChangeText={(text) => setParsedData({ ...parsedData, email: text })}
            placeholder="john@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.formLabel}>Phone</Text>
          <TextInput
            style={styles.input}
            value={parsedData.phone}
            onChangeText={(text) => setParsedData({ ...parsedData, phone: text })}
            placeholder="+1 555-0198"
            keyboardType="phone-pad"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.formLabel}>Address</Text>
          <TextInput
            style={styles.input}
            value={parsedData.address}
            onChangeText={(text) => setParsedData({ ...parsedData, address: text })}
            placeholder="123 Main St"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.formLabel}>Relationship Context / Notes (How we met)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={parsedData.notes}
            onChangeText={(text) => setParsedData({ ...parsedData, notes: text })}
            placeholder="Met at YiFi 2026 conference. We discussed seed stage capital..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />

          <View style={styles.actionRow}>
            {editContactId ? (
              <TouchableOpacity style={styles.retakeBtn} onPress={() => navigation.goBack()} disabled={isSaving}>
                <Text style={styles.retakeBtnText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.retakeBtn} onPress={() => { setParsedData(null); setPhotoUri(null); }} disabled={isSaving}>
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={styles.saveBtnText}>Save Contact</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMobile,
    paddingVertical: Spacing.sm,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  headerBtnText: { fontSize: 24, color: Colors.onSurface, fontWeight: '300' },
  headerTitle: { ...Typography.bodyMd, fontWeight: '700', color: Colors.onSurface },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  permissionText: { ...Typography.bodyMd, color: Colors.onSurface, textAlign: 'center', marginBottom: Spacing.lg },
  btn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.lg },
  btnText: { color: Colors.onPrimary, fontWeight: '700' },
  cameraContainer: { flex: 1, overflow: 'hidden', margin: Spacing.md, borderRadius: Radius.xl },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  guideBox: {
    width: '80%', height: '30%',
    borderWidth: 2, borderColor: Colors.primary,
    backgroundColor: 'transparent',
    borderRadius: Radius.md,
  },
  controls: { height: 120, justifyContent: 'center', alignItems: 'center' },
  captureBtn: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'transparent',
    borderWidth: 4, borderColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  captureBtnInner: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: Colors.primary,
  },
  processingContainer: { alignItems: 'center', gap: Spacing.sm },
  processingText: { ...Typography.bodyMd, color: Colors.primary, fontWeight: '600' },
  formContainer: { padding: Spacing.lg, paddingBottom: 100 },
  formLabel: { ...Typography.labelSm, color: Colors.textSecondary, marginBottom: 4, marginTop: Spacing.md },
  input: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.md, padding: Spacing.md, ...Typography.bodyMd, color: Colors.onSurface },
  actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  retakeBtn: { flex: 1, padding: Spacing.md, alignItems: 'center', borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerHigh },
  retakeBtnText: { ...Typography.bodyMd, fontWeight: '600', color: Colors.onSurface },
  saveBtn: { flex: 2, padding: Spacing.md, alignItems: 'center', borderRadius: Radius.md, backgroundColor: Colors.primary },
  saveBtnText: { ...Typography.bodyMd, fontWeight: '700', color: Colors.onPrimary },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: Spacing.xl,
  },
  galleryBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  galleryBtnText: {
    fontSize: 22,
  },
  spacerBtn: {
    width: 50,
    height: 50,
  },
});
