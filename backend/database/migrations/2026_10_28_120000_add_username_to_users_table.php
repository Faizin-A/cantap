<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable()->unique()->after('name');
        });

        // Existing users keep their accounts. Their initial username is the
        // part of their current email address before "@"; collisions get an ID suffix.
        $used = [];
        foreach (DB::table('users')->select('id', 'email')->orderBy('id')->get() as $user) {
            $prefix = Str::before((string) $user->email, '@');
            $base = Str::slug($prefix, '_');
            if ($base === '') {
                $base = 'admin';
            }

            $username = $base;
            if (isset($used[strtolower($username)])) {
                $username = $base . '_' . $user->id;
            }
            while (isset($used[strtolower($username)])) {
                $username .= '_';
            }

            $used[strtolower($username)] = true;
            DB::table('users')->where('id', $user->id)->update(['username' => $username]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropColumn('username');
        });
    }
};
