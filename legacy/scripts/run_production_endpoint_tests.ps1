# Production endpoint validation script
$base = "http://127.0.0.1:8000"
$results = @()

function Test-Endpoint {
    param($Name, $Method, $Uri, $Body = $null)
    $entry = @{ name = $Name; method = $Method; uri = $Uri; ok = $false }
    try {
        if ($Method -eq "GET") {
            $r = Invoke-RestMethod -Uri $Uri -Method GET -TimeoutSec 120
        } else {
            $r = Invoke-RestMethod -Uri $Uri -Method POST -Body $Body -ContentType "application/json" -TimeoutSec 300
        }
        $entry.ok = $true
        if ($r.success -ne $null) { $entry.success = $r.success }
        if ($r.status) { $entry.status = $r.status }
        if ($r.tools) { $entry.tools = $r.tools.Count }
        if ($r.agents) { $entry.agents = $r.agents.Count }
        if ($r.report) { $entry.report_chars = $r.report.Length }
        if ($r.agent) { $entry.agent = $r.agent }
        if ($r.summary) { $entry.has_summary = $true }
    } catch {
        $entry.ok = $false
        $entry.error = $_.Exception.Message
    }
    return $entry
}

$results += Test-Endpoint "health" "GET" "$base/health"
$results += Test-Endpoint "test_brains" "GET" "$base/test/brains"
$results += Test-Endpoint "tools_manifest" "GET" "$base/tools/manifest"
$results += Test-Endpoint "bitrix_summary" "GET" "$base/tools/bitrix/summary"

$agents = @("ceo", "finance", "sales", "hr", "marketing", "customer_success")
$q = '{"question":"Qisqa executive xulosa: kompaniya nomi va asosiy KPI."}'
foreach ($a in $agents) {
    $results += Test-Endpoint "agent_$a" "POST" "$base/tools/agent/$a" $q
}

$allOk = ($results | Where-Object { -not $_.ok }).Count -eq 0
$report = @{ all_ok = $allOk; results = $results }
$report | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 "scripts/production_endpoint_results.json"
$report | ConvertTo-Json -Depth 5
