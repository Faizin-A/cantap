<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Antrian;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AntrianController extends Controller
{
    public function index(): JsonResponse
    {
        $hariIni = now()->toDateString();

        $antrians = Antrian::whereDate('tanggal', $hariIni)
            ->orderBy('nomor')
            ->get();

        return response()->json([
            'message' => 'Daftar antrean berhasil diambil.',
            'data' => $antrians,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nama' => ['nullable', 'string', 'max:100'],
            'telepon' => ['nullable', 'string', 'max:25', 'regex:/^[0-9+\-\s()]{8,25}$/'],
        ]);

        $antrian = DB::transaction(function () use ($validated) {
            $tanggal = now()->toDateString();

            $nomorTerakhir = Antrian::whereDate('tanggal', $tanggal)
                ->lockForUpdate()
                ->max('nomor') ?? 0;

            return Antrian::create([
                'tanggal' => $tanggal,
                'nomor' => $nomorTerakhir + 1,
                'nama' => $validated['nama'] ?? null,
                'telepon' => $validated['telepon'] ?? null,
                'status' => 'waiting',
            ]);
        });

        return response()->json([
            'message' => 'Nomor antrean berhasil diambil.',
            'data' => $antrian,
        ], 201);
    }

    public function panggilBerikutnya()
    {
        $tanggal = now()->toDateString();

        // Selesaikan antrean yang sedang dilayani.
        \App\Models\Antrian::where('tanggal', $tanggal)
            ->where('status', 'serving')
            ->update([
                'status' => 'done',
                'selesai_pada' => now(),
            ]);

        // Ambil antrean menunggu dengan nomor terkecil.
        $antrian = \App\Models\Antrian::where('tanggal', $tanggal)
            ->where('status', 'waiting')
            ->orderBy('nomor')
            ->first();

        if (!$antrian) {
            return response()->json([
                'message' => 'Tidak ada antrean yang menunggu.',
                'data' => null,
            ], 404);
        }

        $antrian->update([
            'status' => 'serving',
            'dipanggil_pada' => now(),
        ]);

        return response()->json([
            'message' => 'Antrean berikutnya berhasil dipanggil.',
            'data' => $antrian,
        ]);
    }

    public function selesaikan(\App\Models\Antrian $antrian)
    {
        if (
            !Antrian::whereKey($antrian->id)
                ->whereDate('tanggal', now()->toDateString())
                ->exists()
        ) {
            return response()->json([
                'message' => 'Antrean bukan milik hari ini.',
            ], 404);
        }

        if ($antrian->status !== 'serving') {
            return response()->json([
                'message' => 'Hanya antrean yang sedang dilayani yang bisa diselesaikan.',
            ], 422);
        }

        $antrian->update([
            'status' => 'done',
            'selesai_pada' => now(),
        ]);

        return response()->json([
            'message' => 'Antrean berhasil diselesaikan.',
            'data' => $antrian->fresh(),
        ]);
    }

    public function lewati(\App\Models\Antrian $antrian)
    {
        if (
            !Antrian::whereKey($antrian->id)
                ->whereDate('tanggal', now()->toDateString())
                ->exists()
        ) {
            return response()->json([
                'message' => 'Antrean bukan milik hari ini.',
            ], 404);
        }

        if (!in_array($antrian->status, ['waiting', 'serving'], true)) {
            return response()->json([
                'message' => 'Antrean ini sudah tidak bisa dilewati.',
            ], 422);
        }

        $antrian->update([
            'status' => 'skipped',
            'selesai_pada' => now(),
        ]);

        return response()->json([
            'message' => 'Antrean berhasil dilewati.',
            'data' => $antrian->fresh(),
        ]);
    }
    /** Kirim pengingat WhatsApp melalui Fonnte. Hanya admin terautentikasi yang dapat memanggil endpoint ini. */
    public function kirimWhatsApp(Antrian $antrian): JsonResponse
    {
        if (!Antrian::whereKey($antrian->id)
            ->whereDate('tanggal', now()->toDateString())
            ->exists()) {
            return response()->json(['message' => 'Antrean bukan milik hari ini.'], 404);
        }

        if (empty($antrian->telepon)) {
            return response()->json(['message' => 'Pelanggan belum memberikan nomor WhatsApp.'], 422);
        }

        if (!in_array($antrian->status, ['serving', 'skipped'], true)) {
            return response()->json([
                'message' => 'WhatsApp hanya dapat dikirim untuk antrean yang sedang dipanggil atau sudah dilewati.',
            ], 422);
        }

        $token = config('services.fonnte.token');
        if (!$token) {
            return response()->json([
                'message' => 'Token Fonnte belum dikonfigurasi. Tambahkan FONNTE_TOKEN di file backend/.env.',
            ], 503);
        }

        $settings = \App\Models\PengaturanToko::query()->firstOrCreate(
            ['id' => 1],
            ['nama_toko' => 'Antrian Digital', 'deskripsi' => 'Layanan lebih mudah, antre lebih nyaman']
        );

        $nomor = 'A-' . str_pad((string) $antrian->nomor, 3, '0', STR_PAD_LEFT);
        $nama = $antrian->nama ?: 'Pelanggan';
        if ($antrian->status === 'skipped') {
            $message = "Halo {$nama}, nomor antrean {$nomor} di {$settings->nama_toko} tadi sudah dipanggil, tetapi Anda belum terlihat. Silakan hubungi petugas atau datang ke meja layanan untuk memastikan apakah antrean masih bisa dilayani. Terima kasih.";
        } else {
            $message = "Halo {$nama}, nomor antrean {$nomor} di {$settings->nama_toko} sedang dipanggil. Silakan menuju petugas sekarang. Terima kasih.";
        }

        // Fonnte mengharapkan nomor target sebagai string; countryCode 62 menangani nomor lokal Indonesia.
        $target = preg_replace('/\D+/', '', $antrian->telepon);
        if (str_starts_with($target, '62')) {
            $target = substr($target, 2);
        }
        if (str_starts_with($target, '0')) {
            // Biarkan Fonnte mengganti awalan 0 dengan kode negara 62.
        } elseif (str_starts_with($target, '8')) {
            $target = '0' . $target;
        }

        try {
            $response = \Illuminate\Support\Facades\Http::asForm()
                ->withHeaders(['Authorization' => $token])
                ->timeout(20)
                ->post('https://api.fonnte.com/send', [
                    'target' => $target,
                    'message' => $message,
                    'countryCode' => '62',
                    'connectOnly' => 'true',
                ]);
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'message' => 'Tidak dapat terhubung ke Fonnte. Periksa koneksi server dan coba lagi.',
            ], 502);
        }

        $result = $response->json();
        if (!$response->successful() || !is_array($result) || !($result['status'] ?? $result['Status'] ?? false)) {
            return response()->json([
                'message' => $result['reason'] ?? $result['detail'] ?? 'Fonnte gagal menerima pesan. Periksa token, koneksi perangkat WhatsApp, dan kuota Fonnte.',
                'fonnte' => $result,
            ], 502);
        }

        return response()->json([
            'message' => 'Permintaan pesan WhatsApp diterima Fonnte untuk dikirim ke ' . $nomor . '.',
            'data' => ['requestid' => $result['requestid'] ?? null, 'status' => $result['status'] ?? true],
        ]);
    }

}