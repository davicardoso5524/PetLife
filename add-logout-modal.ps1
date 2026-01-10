# Script para adicionar modal de logout em todas as páginas

$files = @(
    "public/dashboard.html",
    "public/packages.html",
    "public/expenses.html",
    "public/bills-overview.html",
    "public/bills.html",
    "public/reports.html",
    "public/admin.html"
)

$logoutModal = @"

    <!-- Logout Modal -->
    <div id="logout-modal" class="modal">
        <div class="logout-modal-content modal-content">
            <div class="logout-icon">
                <i class="fa-solid fa-right-from-bracket"></i>
            </div>
            <h2>Sair do Sistema?</h2>
            <p>Você será desconectado e precisará fazer login novamente para acessar o sistema.</p>
            <div class="logout-actions">
                <button type="button" class="btn-cancel-logout" onclick="cancelLogout()">
                    Cancelar
                </button>
                <button type="button" class="btn-confirm-logout" id="btn-confirm-logout" onclick="confirmLogout()">
                    <i class="fa-solid fa-right-from-bracket"></i> Sair
                </button>
            </div>
        </div>
    </div>
"@

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        
        # Adiciona modal de logout antes do fechamento do body se não existir
        if ($content -notmatch "logout-modal") {
            $content = $content -replace '(\s*)<script src="js/', "$logoutModal`n`n    <script src=`"js/"
            Set-Content -Path $file -Value $content -NoNewline
            Write-Host "Adicionado logout modal em $file"
        } else {
            Write-Host "Logout modal já existe em $file"
        }
    }
}

Write-Host "Concluído!"
