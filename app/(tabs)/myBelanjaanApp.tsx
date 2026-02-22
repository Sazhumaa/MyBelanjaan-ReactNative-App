import { useState, useEffect, useCallback } from "react";
import { Alert, FlatList, Image, View, TouchableOpacity } from "react-native";
import { Button, Card, TextInput, FAB, Dialog, Portal, Text, Checkbox, IconButton, Surface, Divider } from "react-native-paper";
import * as SQLite from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

type Item = {
    id: number;
    name: string;
    price: number;
    category: string;
    stock: number;
    image: string;
    isChecked?: boolean;
}

let db: SQLite.SQLiteDatabase;

export default function MyBelanjaanApp() {
    const [editId, setEditId] = useState<number | null>(null);
    const [visible, setVisible] = useState(false);
    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState<number[]>([]);

    const [formdata, setFormdata] = useState({
        name: "",
        price: "",
        category: "",
        stock: "",
        image: ""
    });

    // Gunakan useCallback untuk membungkus fungsi loadItems
    const loadItems = useCallback(async () => {
        try {
            if (!db) {
                db = await SQLite.openDatabaseAsync('shopping.db');
            }
            const result = await db.getAllAsync(
                `SELECT * FROM shopping_items ORDER BY id DESC`
            );
            setItems(result as Item[]);
        } catch {
            Alert.alert('Gagal', 'Gagal memuat daftar belanja');
        }
    }, []);

    // Gunakan useCallback untuk membungkus fungsi initDatabase
    const initDatabase = useCallback(async () => {
        try {
            db = await SQLite.openDatabaseAsync('shopping.db');
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS shopping_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    price INTEGER NOT NULL,
                    category TEXT NOT NULL,
                    stock INTEGER NOT NULL,
                    image TEXT NOT NULL
                );
            `);
            console.log("Database initialized successfully");
            await loadItems();
        } catch (error) {
            console.error("Database init error:", error);
            Alert.alert("Error", "Gagal inisialisasi database");
        }
    }, [loadItems]); // loadItems sebagai dependency

    useEffect(() => {
        initDatabase();
    }, [initDatabase]); // initDatabase sebagai dependency

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Izin diperlukan", "Aplikasi membutuhkan akses ke galeri");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
            
            if (!result.canceled) {
                setFormdata({...formdata, image: result.assets[0].uri});
            }
        } catch {
            Alert.alert("Gagal", "Gagal memilih gambar");
        }
    };
    
    const resetForm = () => {
        setFormdata({
            name: "",
            price: "",
            category: "",
            stock: "",
            image: ""
        });
        setEditId(null);
    };

    const formatPrice = (price: number) => {
        return `Rp ${price.toLocaleString('id-ID')}`;
    };

    const saveItem = async () => {
        try {
            setIsLoading(true);
            
            if (!formdata.name.trim()) {
                Alert.alert("Error", "Nama barang harus diisi!");
                setIsLoading(false);
                return;
            }
            if (!formdata.price.trim()) {
                Alert.alert("Error", "Harga harus diisi!");
                setIsLoading(false);
                return;
            }
            if (!formdata.category.trim()) {
                Alert.alert("Error", "Kategori harus diisi!");
                setIsLoading(false);
                return;
            }
            if (!formdata.stock.trim()) {
                Alert.alert("Error", "Stok harus diisi!");
                setIsLoading(false);
                return;
            }
            if (!formdata.image) {
                Alert.alert("Error", "Gambar harus dipilih!");
                setIsLoading(false);
                return;
            }

            const price = parseInt(formdata.price);
            const stock = parseInt(formdata.stock);
            
            if (isNaN(price) || price <= 0) {
                Alert.alert("Error", "Harga harus angka positif!");
                setIsLoading(false);
                return;
            }

            if (isNaN(stock) || stock <= 0) {
                Alert.alert("Error", "Stok harus angka positif!");
                setIsLoading(false);
                return;
            }

            if (!db) {
                db = await SQLite.openDatabaseAsync('shopping.db');
            }

            if (editId) {
                await db.runAsync(
                    `UPDATE shopping_items SET name = ?, price = ?, category = ?, stock = ?, image = ? WHERE id = ?`,
                    [formdata.name.trim(), price, formdata.category.trim(), stock, formdata.image, editId]
                );
                Alert.alert("Sukses", "Item berhasil diupdate!");
            } else {
                await db.runAsync(
                    `INSERT INTO shopping_items (name, price, category, stock, image) VALUES (?, ?, ?, ?, ?)`,
                    [formdata.name.trim(), price, formdata.category.trim(), stock, formdata.image]
                );
                Alert.alert("Sukses", "Item berhasil ditambahkan!");
            }

            await loadItems();
            resetForm();
            setVisible(false);

        } catch {
            Alert.alert("Error", "Gagal menyimpan item");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleEdit = (item: Item) => {
        setFormdata({
            name: item.name,
            price: item.price.toString(),
            category: item.category,
            stock: item.stock.toString(),
            image: item.image
        });
        setEditId(item.id);
        setVisible(true);
    };

    const toggleItemSelection = (id: number) => {
        setSelectedItems(prev => {
            if (prev.includes(id)) {
                return prev.filter(itemId => itemId !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const deleteSelectedItems = async () => {
        if (selectedItems.length === 0) {
            Alert.alert("Info", "Pilih item yang ingin dihapus terlebih dahulu");
            return;
        }

        Alert.alert(
            "Konfirmasi Hapus",
            `Hapus ${selectedItems.length} item yang dipilih?`,
            [
                { text: "Batal", style: "cancel" },
                {
                    text: "Hapus",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsLoading(true);
                            if (!db) {
                                db = await SQLite.openDatabaseAsync('shopping.db');
                            }
                            
                            for (const id of selectedItems) {
                                await db.runAsync(`DELETE FROM shopping_items WHERE id = ?`, [id]);
                            }
                            
                            setItems(items.filter(item => !selectedItems.includes(item.id)));
                            setSelectedItems([]);
                            Alert.alert("Sukses", `${selectedItems.length} item berhasil dihapus`);
                        } catch {
                            Alert.alert("Error", "Gagal menghapus item");
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const calculateTotal = () => {
        return items.reduce((total, item) => total + (item.price * item.stock), 0);
    };

    const totalItems = items.length;
    const totalSelected = selectedItems.length;

    const formatPriceWithEllipsis = (price: number) => {
        const formatted = formatPrice(price);
        if (formatted.length > 15) {
            return formatted.substring(0, 12) + '...';
        }
        return formatted;
    };

    return (
        <>
            <StatusBar style="auto" />
            <Stack.Screen options={{ 
                title: 'Daftar Belanja', 
                headerShown: true,
                headerRight: () => (
                    <View style={{ flexDirection: 'row' }}>
                        {totalSelected > 0 && (
                            <IconButton 
                                icon="delete" 
                                iconColor="red"
                                size={24} 
                                onPress={deleteSelectedItems}
                            />
                        )}
                    </View>
                )
            }} />
            
            <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
                {/* Header */}
                <Surface style={{ elevation: 2, padding: 16, backgroundColor: 'white' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text variant="titleLarge" style={{ fontWeight: 'bold', color: '#333' }}>
                                Daftar Belanja
                            </Text>
                            <Text variant="bodyMedium" style={{ color: '#666' }}>
                                {totalItems} item • {totalSelected} dipilih
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', maxWidth: '50%' }}>
                            <Text variant="bodySmall" style={{ color: '#666' }}>Total</Text>
                            <Text 
                                variant="headlineSmall" 
                                style={{ 
                                    fontWeight: 'bold', 
                                    color: '#2ecc71',
                                    fontSize: 20,
                                    textAlign: 'right'
                                }}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {formatPrice(calculateTotal())}
                            </Text>
                        </View>
                    </View>
                </Surface>

                <Divider />

                <View style={{ padding: 12, flex: 1 }}>
                    {items.length === 0 ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text variant="bodyLarge" style={{ color: '#999', marginTop: 8 }}>
                                Belum ada item belanja
                            </Text>
                            <Text variant="bodySmall" style={{ color: '#999', marginTop: 4 }}>
                                Tambahkan item baru dengan tombol +
                            </Text>
                        </View>
                    ) : (
                        <FlatList 
                            data={items}
                            keyExtractor={(item) => item.id.toString()}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const isSelected = selectedItems.includes(item.id);
                                return (
                                    <TouchableOpacity 
                                        onPress={() => toggleItemSelection(item.id)}
                                        activeOpacity={0.7}
                                    >
                                        <Card 
                                            style={{ 
                                                marginBottom: 12,
                                                backgroundColor: isSelected ? '#f9f9f9' : 'white',
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', padding: 12 }}>
                                                {/* Checkbox */}
                                                <View style={{ justifyContent: 'center', marginRight: 8 }}>
                                                    <Checkbox
                                                        status={isSelected ? 'checked' : 'unchecked'}
                                                        onPress={() => toggleItemSelection(item.id)}
                                                        color="#2ecc71"
                                                    />
                                                </View>

                                                {/* Gambar */}
                                                <Card.Cover 
                                                    source={{ uri: item.image || 'https://via.placeholder.com/80' }} 
                                                    style={{ width: 70, height: 70, borderRadius: 8 }}
                                                />
                                                
                                                {/* Konten */}
                                                <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
                                                    <Text 
                                                        variant="titleMedium" 
                                                        style={{ 
                                                            fontWeight: '600',
                                                            textDecorationLine: isSelected ? 'line-through' : 'none',
                                                            color: isSelected ? '#999' : '#333',
                                                            marginBottom: 4
                                                        }}
                                                        numberOfLines={1}
                                                    >
                                                        {item.name}
                                                    </Text>
                                                    
                                                    {/* Harga */}
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <Text 
                                                            variant="bodyLarge" 
                                                            style={{ 
                                                                color: '#2ecc71', 
                                                                fontWeight: 'bold',
                                                                marginRight: 8
                                                            }}
                                                            numberOfLines={1}
                                                        >
                                                            {formatPriceWithEllipsis(item.price)}
                                                        </Text>
                                                        
                                                        <View style={{ 
                                                            backgroundColor: '#e8f5e9',
                                                            paddingHorizontal: 8,
                                                            paddingVertical: 2,
                                                            borderRadius: 12
                                                        }}>
                                                            <Text style={{ fontSize: 11, color: '#2e7d32' }}>
                                                                Stok: {item.stock}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    
                                                    {/* Kategori dan subtotal */}
                                                    <View style={{ 
                                                        flexDirection: 'row', 
                                                        justifyContent: 'space-between', 
                                                        alignItems: 'center',
                                                        marginTop: 6
                                                    }}>
                                                        <View style={{ 
                                                            backgroundColor: '#f0f0f0',
                                                            paddingHorizontal: 8,
                                                            paddingVertical: 2,
                                                            borderRadius: 12,
                                                        }}>
                                                            <Text style={{ fontSize: 11, color: '#666' }}>
                                                                {item.category}
                                                            </Text>
                                                        </View>
                                                        
                                                        <Text 
                                                            variant="bodySmall" 
                                                            style={{ color: '#999' }}
                                                            numberOfLines={1}
                                                        >
                                                            Sub: {formatPriceWithEllipsis(item.price * item.stock)}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* Tombol Edit */}
                                                <IconButton
                                                    icon="pencil-outline"
                                                    size={18}
                                                    onPress={() => handleEdit(item)}
                                                    style={{ alignSelf: 'center', marginLeft: 4 }}
                                                />
                                            </View>
                                        </Card>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    )}
                </View>

                {/* FAB */}
                <FAB
                    icon="plus"
                    style={{
                        position: 'absolute',
                        margin: 16,
                        right: 0,
                        bottom: 0,
                        backgroundColor: '#2ecc71'
                    }}
                    onPress={() => {
                        resetForm();
                        setVisible(true);
                    }}
                />

                {/* Dialog Form */}
                <Portal>
                    <Dialog 
                        visible={visible} 
                        onDismiss={() => { setVisible(false); resetForm(); }}
                        style={{ backgroundColor: 'white' }}
                    >
                        <Dialog.Title style={{ color: '#333', fontWeight: '600' }}>
                            {editId ? "Edit Item" : "Tambah Item"}
                        </Dialog.Title>
                        
                        <Dialog.Content>
                            <View style={{ alignItems: 'center', marginBottom: 16 }}>
                                {formdata.image ? (
                                    <Image 
                                        source={{ uri: formdata.image }} 
                                        style={{ width: 100, height: 100, borderRadius: 8, marginBottom: 8 }}
                                    />
                                ) : (
                                    <TouchableOpacity onPress={pickImage}>
                                        <View style={{ 
                                            width: 100, 
                                            height: 100, 
                                            borderRadius: 8, 
                                            backgroundColor: '#f0f0f0',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            borderWidth: 1,
                                            borderColor: '#ddd',
                                            borderStyle: 'dashed'
                                        }}>
                                            <Text style={{ color: '#999', fontSize: 12 }}>Pilih Gambar</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TextInput 
                                label="Nama Barang" 
                                mode="outlined"
                                onChangeText={(text) => setFormdata({ ...formdata, name: text })}
                                value={formdata.name}
                                style={{ marginBottom: 12 }}
                                outlineColor="#ddd"
                                activeOutlineColor="#2ecc71"
                            />
                            
                            <TextInput 
                                label="Harga" 
                                mode="outlined"
                                onChangeText={(text) => setFormdata({ ...formdata, price: text })}
                                value={formdata.price}
                                keyboardType="number-pad"
                                style={{ marginBottom: 12 }}
                                outlineColor="#ddd"
                                activeOutlineColor="#2ecc71"
                            />
                            
                            <TextInput 
                                label="Kategori" 
                                mode="outlined"
                                onChangeText={(text) => setFormdata({ ...formdata, category: text })}
                                value={formdata.category}
                                style={{ marginBottom: 12 }}
                                outlineColor="#ddd"
                                activeOutlineColor="#2ecc71"
                            />
                            
                            <TextInput 
                                label="Stok" 
                                mode="outlined"
                                onChangeText={(text) => setFormdata({ ...formdata, stock: text })}
                                value={formdata.stock}
                                keyboardType="number-pad"
                                outlineColor="#ddd"
                                activeOutlineColor="#2ecc71"
                            />
                        </Dialog.Content>
                        
                        <Dialog.Actions>
                            <Button onPress={() => { setVisible(false); resetForm(); }} textColor="#666">
                                Batal
                            </Button>
                            <Button 
                                onPress={saveItem} 
                                loading={isLoading} 
                                disabled={isLoading}
                                mode="contained"
                                buttonColor="#2ecc71"
                            >
                                {editId ? "Update" : "Simpan"}
                            </Button>
                        </Dialog.Actions>
                    </Dialog>
                </Portal>
            </View>
        </>
    );
}