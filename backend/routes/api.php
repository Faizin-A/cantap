
<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AntrianController;
use App\Http\Controllers\Api\PengaturanController;
use Illuminate\Support\Facades\Route;

// Endpoint yang boleh diakses pelanggan
Route::get('/antrian', [AntrianController::class, 'index']);
Route::post('/antrian', [AntrianController::class, 'store']);
Route::get('/pengaturan', [PengaturanController::class, 'show']);

// Endpoint login admin
Route::post('/login', [AuthController::class, 'login']);

// Endpoint khusus admin
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/account/password', [AuthController::class, 'updatePassword']);
    Route::put('/pengaturan', [PengaturanController::class, 'update']);
    Route::post('/antrian/{antrian}/whatsapp', [AntrianController::class, 'kirimWhatsApp']);

    Route::post('/antrian/panggil-berikutnya', [
        AntrianController::class,
        'panggilBerikutnya',
    ]);

    Route::post('/antrian/{antrian}/lewati', [
        AntrianController::class,
        'lewati',
    ]);

    Route::post('/antrian/{antrian}/selesaikan', [
        AntrianController::class,
        'selesaikan',
    ]);
});