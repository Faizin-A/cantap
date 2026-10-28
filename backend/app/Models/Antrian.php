<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Antrian extends Model
{
    protected $fillable = [
        'tanggal',
        'nomor',
        'nama',
        'telepon',
        'status',
        'dipanggil_pada',
        'selesai_pada',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
            'dipanggil_pada' => 'datetime',
            'selesai_pada' => 'datetime',
        ];
    }
}