<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PengaturanToko;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PengaturanController extends Controller
{
    private function currentSettings(): PengaturanToko
    {
        return PengaturanToko::query()->firstOrCreate(
            ['id' => 1],
            [
                'nama_toko' => 'Antrian Digital',
                'deskripsi' => 'Layanan lebih mudah, antre lebih nyaman',
            ]
        );
    }

    // Pengaturan publik agar halaman pelanggan bisa menampilkan nama/deskripsi toko.
    public function show(): JsonResponse
    {
        $settings = $this->currentSettings();

        return response()->json([
            'message' => 'Pengaturan toko berhasil diambil.',
            'data' => [
                'nama_toko' => $settings->nama_toko,
                'deskripsi' => $settings->deskripsi,
            ],
        ]);
    }

    // Perubahan pengaturan hanya boleh dilakukan oleh admin yang sudah login.
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nama_toko' => ['required', 'string', 'max:80'],
            'deskripsi' => ['required', 'string', 'max:240'],
        ]);

        $settings = $this->currentSettings();
        $settings->update($validated);

        return response()->json([
            'message' => 'Nama dan deskripsi toko berhasil disimpan.',
            'data' => [
                'nama_toko' => $settings->nama_toko,
                'deskripsi' => $settings->deskripsi,
            ],
        ]);
    }
}
