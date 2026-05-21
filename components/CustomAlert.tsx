import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-react-native';

const { width } = Dimensions.get('window');

type AlertType = 'success' | 'error' | 'warning' | 'info';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertConfig = {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
};

// Singleton para controlar o alert de qualquer lugar
let showAlertFn: ((config: AlertConfig) => void) | null = null;

export const CustomAlertService = {
  show: (title: string, message?: string, buttons?: AlertButton[], type?: AlertType) => {
    if (showAlertFn) {
      showAlertFn({ title, message, type: type || 'info', buttons });
    }
  },
  success: (title: string, message?: string, buttons?: AlertButton[]) => {
    CustomAlertService.show(title, message, buttons, 'success');
  },
  error: (title: string, message?: string, buttons?: AlertButton[]) => {
    CustomAlertService.show(title, message, buttons, 'error');
  },
  warning: (title: string, message?: string, buttons?: AlertButton[]) => {
    CustomAlertService.show(title, message, buttons, 'warning');
  },
  info: (title: string, message?: string, buttons?: AlertButton[]) => {
    CustomAlertService.show(title, message, buttons, 'info');
  },
};

const typeConfig = {
  success: { color: '#10B981', bgColor: '#ECFDF5', icon: CheckCircle },
  error: { color: '#EF4444', bgColor: '#FEF2F2', icon: XCircle },
  warning: { color: '#F59E0B', bgColor: '#FFFBEB', icon: AlertCircle },
  info: { color: '#3B82F6', bgColor: '#EFF6FF', icon: Info },
};

export default function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({ title: '' });
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const showAlert = useCallback((alertConfig: AlertConfig) => {
    setConfig(alertConfig);
    setVisible(true);
  }, []);

  useEffect(() => {
    showAlertFn = showAlert;
    return () => { showAlertFn = null; };
  }, [showAlert]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleClose = (onPress?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      if (onPress) onPress();
    });
  };

  const { color, bgColor, icon: Icon } = typeConfig[config.type || 'info'];
  const buttons = config.buttons && config.buttons.length > 0
    ? config.buttons
    : [{ text: 'OK', style: 'default' as const }];

  return (
    <>
      {children}
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
            {/* Ícone */}
            <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
              <Icon size={32} color={color} />
            </View>

            {/* Título */}
            <Text style={styles.title}>{config.title}</Text>

            {/* Mensagem */}
            {config.message ? (
              <Text style={styles.message}>{config.message}</Text>
            ) : null}

            {/* Botões */}
            <View style={[styles.buttonsContainer, buttons.length > 1 && styles.buttonsRow]}>
              {buttons.map((btn, index) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                const isPrimary = !isDestructive && !isCancel;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      isPrimary && { backgroundColor: color },
                      isCancel && styles.buttonCancel,
                      isDestructive && styles.buttonDestructive,
                      buttons.length > 1 && { flex: 1 },
                    ]}
                    onPress={() => handleClose(btn.onPress)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isPrimary && { color: '#fff' },
                        isCancel && styles.buttonCancelText,
                        isDestructive && styles.buttonDestructiveText,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Botão X no canto */}
            <TouchableOpacity style={styles.closeButton} onPress={() => handleClose()}>
              <X size={20} color="#999" />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonsContainer: {
    width: '100%',
    gap: 10,
  },
  buttonsRow: {
    flexDirection: 'row',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  buttonCancel: {
    backgroundColor: '#F3F4F6',
  },
  buttonCancelText: {
    color: '#666',
  },
  buttonDestructive: {
    backgroundColor: '#FEE2E2',
  },
  buttonDestructiveText: {
    color: '#DC2626',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
  },
});
