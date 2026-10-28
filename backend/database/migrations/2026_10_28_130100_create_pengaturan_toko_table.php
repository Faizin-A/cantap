<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('pengaturan_toko')) {
            Schema::create('pengaturan_toko', function (Blueprint $table) {
                $table->id();
                $table->string('nama_toko', 80)->default('Antrian Digital');
                $table->string('deskripsi', 240)->default('Layanan lebih mudah, antre lebih nyaman');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pengaturan_toko');
    }
};
