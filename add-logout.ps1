# Script para adicionar botão de logout em todas as páginas HTML

$files = @(
    "public/packages.html",
    "public/expenses.html", 
    "public/bills-overview.html",
    "public/bills.html",
    "public/reports.html"
)

$logoutButton = @"
            <div class="sidebar-footer">
                <button class="btn-logout" onclick="logout()">
                    <i class="fa-solid fa-right-from-bracket"></i> Sair
                </button>
            </div>
"@

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    
    # Adiciona botão de logout antes do fechamento da nav
    if ($content -notmatch "sidebar-footer") {
        $content = $content -replace '(\s*)</ul>\s*</nav>', "`$1</ul>`n$logoutButton`n        </nav>"
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "Adicionado logout button em $file"
    }
    
    # Adiciona auth.js se não existir
    if ($content -notmatch "auth\.js") {
        $content = $content -replace '(\s*)<script src="js/app\.js">', "    <script src=`"js/auth.js`"></script>`n`$1<script src=`"js/app.js`">"
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "Adicionado auth.js em $file"
    }
}

Write-Host "Concluído!"
