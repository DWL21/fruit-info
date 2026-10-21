#!/usr/bin/env bash
# pahidc에서 한 번 실행한다: sudo bash deploy/host/install.sh
# 커널 패닉 자동 재부팅과 softdog 워치독 설정을 설치하고 바로 적용한다.
set -euo pipefail
cd "$(dirname "$0")"

install -m 644 99-fruit-auto-reboot.conf /etc/sysctl.d/99-fruit-auto-reboot.conf
install -d -m 755 /etc/systemd/system.conf.d
install -m 644 10-fruit-watchdog.conf /etc/systemd/system.conf.d/10-fruit-watchdog.conf
install -m 644 fruit-softdog.service /etc/systemd/system/fruit-softdog.service
# 블랙리스트 때문에 효과가 없는 이전 설치 파일을 지운다.
rm -f /etc/modules-load.d/softdog.conf

sysctl --load /etc/sysctl.d/99-fruit-auto-reboot.conf
systemctl daemon-reexec
systemctl enable fruit-softdog.service
systemctl restart fruit-softdog.service

sysctl kernel.panic kernel.panic_on_oops kernel.softlockup_panic
systemctl show -p RuntimeWatchdogUSec -p RebootWatchdogUSec
systemctl is-enabled fruit-softdog.service
ls -l /dev/watchdog
