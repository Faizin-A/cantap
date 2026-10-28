<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'username' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::attempt($credentials)) {
            throw ValidationException::withMessages([
                'username' => ['Username atau password salah.'],
            ]);
        }

        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'message' => 'Autentikasi gagal.',
            ], 401);
        }

        $token = $user->createToken('admin-antrian')->plainTextToken;

        return response()->json([
            'message' => 'Login berhasil.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
            ],
            'token' => $token,
        ]);
    }


    public function updatePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'current_password.required' => 'Password saat ini wajib diisi.',
            'password.required' => 'Password baru wajib diisi.',
            'password.min' => 'Password baru minimal 8 karakter.',
            'password.confirmed' => 'Konfirmasi password baru tidak cocok.',
        ]);

        $user = $request->user();

        if (!$user || !Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'message' => 'Password saat ini tidak benar.',
                'errors' => [
                    'current_password' => ['Password saat ini tidak benar.'],
                ],
            ], 422);
        }

        if (Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Password baru harus berbeda dari password saat ini.',
                'errors' => [
                    'password' => ['Password baru harus berbeda dari password saat ini.'],
                ],
            ], 422);
        }

        // Model User memakai cast hashed, jadi password akan di-hash otomatis.
        $user->password = $validated['password'];
        $user->save();

        // Pertahankan token aktif agar admin tidak langsung ter-logout.
        // Cabut token lain untuk mengakhiri sesi lama di perangkat lain.
        $currentToken = $user->currentAccessToken();
        if ($currentToken && method_exists($currentToken, 'getKey')) {
            $user->tokens()->where('id', '!=', $currentToken->getKey())->delete();
        }

        return response()->json([
            'message' => 'Password berhasil diperbarui. Gunakan password baru pada login berikutnya.',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $token = $user->currentAccessToken();

        if ($token) {
            $token->delete();
        }

        return response()->json([
            'message' => 'Logout berhasil.',
        ]);
    }
}