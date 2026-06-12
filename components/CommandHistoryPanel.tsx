import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
    Pressable,
    FlatList
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { AIMessage } from '@/types';

const { width } = Dimensions.get('window');
const PANEL_WIDTH = width * 0.75;

interface CommandHistoryPanelProps {
    isVisible: boolean;
    onClose: () => void;
    messages: AIMessage[];
}

export function CommandHistoryPanel({ isVisible, onClose, messages }: CommandHistoryPanelProps) {
    const slideAnim = useRef(new Animated.Value(-PANEL_WIDTH)).current;

    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: isVisible ? 0 : -PANEL_WIDTH,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [isVisible]);

    if (!isVisible && slideAnim === new Animated.Value(-PANEL_WIDTH)) return null;

    const renderItem = ({ item }: { item: AIMessage }) => (
        <View style={styles.historyItem}>
            <View style={styles.historyHeader}>
                <MaterialIcons
                    name={item.role === 'user' ? 'person' : 'smart-toy'}
                    size={16}
                    color={item.role === 'user' ? theme.colors.primary : theme.colors.secondary}
                />
                <Text style={styles.historyTime}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
            <Text style={styles.historyText} numberOfLines={2}>{item.content}</Text>
        </View>
    );

    return (
        <>
            {isVisible && (
                <Pressable style={styles.backdrop} onPress={onClose}>
                    <View style={styles.backdropInner} />
                </Pressable>
            )}
            <Animated.View style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Command History</Text>
                    <Pressable onPress={onClose} style={styles.closeButton}>
                        <MaterialIcons name="close" size={24} color={theme.colors.text} />
                    </Pressable>
                </View>

                <FlatList
                    data={[...messages].reverse()}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No commands yet</Text>
                        </View>
                    }
                />
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    backdropInner: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    panel: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: PANEL_WIDTH,
        backgroundColor: theme.colors.surface,
        zIndex: 1001,
        paddingTop: 60,
        borderRightWidth: 1,
        borderRightColor: theme.colors.surfaceLight,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.text,
    },
    closeButton: {
        padding: 4,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    historyItem: {
        backgroundColor: theme.colors.surfaceLight,
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    historyTime: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    historyText: {
        fontSize: 14,
        color: theme.colors.text,
        lineHeight: 20,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        color: theme.colors.textSecondary,
        fontSize: 16,
    },
});
